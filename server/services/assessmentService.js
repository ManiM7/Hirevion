const AssessmentAttempt = require('../models/AssessmentAttempt');
const AssessmentAnswer = require('../models/AssessmentAnswer');
const Question = require('../models/Question');
const CandidateProfile = require('../models/CandidateProfile');
const Resume = require('../models/Resume');
const ApiError = require('../utils/ApiError');
const { DIFFICULTY_ORDER, nextSkillState, selectNextQuestion } = require('./adaptiveAssessmentService');
const { extractSkills } = require('./skillExtractionService');

const DIFFICULTY_INDEX = Object.fromEntries(DIFFICULTY_ORDER.map((d, i) => [d, i]));
const { logActivity } = require('./activityService');

const QUESTIONS_PER_SKILL = 4;
const MAX_TOTAL_QUESTIONS = 20;
const SECONDS_PER_QUESTION = 90;
const MAX_WARNINGS = 2;
const HARD_VIOLATION_TYPES = new Set(['tab_switch', 'window_blur', 'fullscreen_exit', 'dev_tools_shortcut']);
const APTITUDE_PSEUDO_SKILL = 'Aptitude';

function combinedExcludeIds(attempt) {
  return [...attempt.askedQuestionIds, ...(attempt.priorHistoryQuestionIds || [])];
}

function sanitizeQuestion(question, meta) {
  if (!question) return null;
  return {
    id: question._id,
    skill: question.skill,
    type: question.type,
    difficulty: question.difficulty,
    question: question.question,
    codeSnippet: question.codeSnippet,
    options: question.options,
    ...meta,
  };
}

function initialSkillState() {
  return {
    difficulty: 'Easy',
    correctStreak: 0,
    wrongStreak: 0,
    correctCount: 0,
    wrongCount: 0,
    highestDifficultyReached: 'Easy',
  };
}

/**
 * selectNextQuestion may fall back to a difficulty other than the one
 * requested when the question bank is thin. When that happens, the
 * skill's tracked difficulty must be updated to match what was actually
 * served — otherwise the next escalation decision would be computed
 * against a stale difficulty the candidate was never actually tested at.
 */
function syncStateToServedQuestion(attempt, question) {
  const state = attempt.skillState[question.skill] || initialSkillState();
  state.difficulty = question.difficulty;
  if (DIFFICULTY_INDEX[question.difficulty] > DIFFICULTY_INDEX[state.highestDifficultyReached]) {
    state.highestDifficultyReached = question.difficulty;
  }
  attempt.skillState[question.skill] = state;
  attempt.markModified('skillState');
}

function isExpired(attempt) {
  const deadline = new Date(attempt.startTime.getTime() + attempt.timeLimitSeconds * 1000);
  return new Date() > deadline;
}

async function loadOwnedAttempt(attemptId, candidateId) {
  const attempt = await AssessmentAttempt.findById(attemptId);
  if (!attempt) throw new ApiError(404, 'Assessment not found');
  if (String(attempt.candidate) !== String(candidateId)) {
    throw new ApiError(403, 'This assessment does not belong to you');
  }
  return attempt;
}

async function computeAndStoreResult(attempt) {
  const answers = await AssessmentAnswer.find({ attempt: attempt._id });

  const bySkill = {};
  let correctCount = 0;
  for (const ans of answers) {
    bySkill[ans.skill] = bySkill[ans.skill] || { correct: 0, total: 0 };
    bySkill[ans.skill].total += 1;
    if (ans.isCorrect) {
      bySkill[ans.skill].correct += 1;
      correctCount += 1;
    }
  }

  const skillScores = {};
  for (const [skill, { correct, total }] of Object.entries(bySkill)) {
    skillScores[skill] = total === 0 ? 0 : Math.round((correct / total) * 100);
  }

  const totalAnswered = answers.length;
  const totalScore = totalAnswered === 0 ? 0 : Math.round((correctCount / totalAnswered) * 100);
  const accuracy = totalScore;
  const timeTakenSeconds = Math.round(((attempt.endTime || new Date()) - attempt.startTime) / 1000);

  attempt.result = {
    totalScore,
    correctCount,
    wrongCount: totalAnswered - correctCount,
    accuracy,
    timeTakenSeconds,
    skillScores,
  };

  return attempt.result;
}

async function refreshCandidateAggregates(candidateProfileId) {
  const attempts = await AssessmentAttempt.find({
    candidate: candidateProfileId,
    status: { $in: ['completed', 'terminated'] },
    'result.totalScore': { $ne: null },
  }).sort({ createdAt: -1 });

  if (attempts.length === 0) return;

  const scores = attempts.map((a) => a.result.totalScore);
  const averageScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const bestScore = Math.max(...scores);

  const skillTotals = {};
  for (const a of attempts) {
    for (const [skill, score] of Object.entries(a.result.skillScores || {})) {
      skillTotals[skill] = skillTotals[skill] || [];
      skillTotals[skill].push(score);
    }
  }
  const skillAverages = Object.entries(skillTotals).map(([skill, arr]) => ({
    skill,
    avg: arr.reduce((s, v) => s + v, 0) / arr.length,
  }));
  skillAverages.sort((a, b) => b.avg - a.avg);
  const strongestSkill = skillAverages[0]?.skill || null;
  const weakestSkill = skillAverages[skillAverages.length - 1]?.skill || null;

  const questionsAnswered = attempts.reduce((s, a) => s + (a.result.correctCount + a.result.wrongCount), 0);
  const correctAnswered = attempts.reduce((s, a) => s + a.result.correctCount, 0);

  await CandidateProfile.updateOne(
    { _id: candidateProfileId },
    {
      $set: {
        assessmentScore: averageScore,
        'assessmentStats.testsCompleted': attempts.length,
        'assessmentStats.averageScore': averageScore,
        'assessmentStats.bestScore': bestScore,
        'assessmentStats.strongestSkill': strongestSkill,
        'assessmentStats.weakestSkill': weakestSkill,
        'assessmentStats.questionsAnswered': questionsAnswered,
        'assessmentStats.correctAnswered': correctAnswered,
        lastAssessmentAt: new Date(),
        lastActive: new Date(),
      },
    }
  );
}

async function finalizeAttempt(attempt, { status, terminationReason = null }) {
  attempt.status = status;
  attempt.terminationReason = terminationReason;
  attempt.endTime = new Date();
  attempt.currentQuestionId = null;
  attempt.currentQuestionIssuedAt = null;
  await computeAndStoreResult(attempt);
  await attempt.save();
  await refreshCandidateAggregates(attempt.candidate);

  const user = await CandidateProfile.findById(attempt.candidate).select('user');
  if (user) {
    await logActivity(user.user, status === 'terminated' ? 'ASSESSMENT_TERMINATED' : 'ASSESSMENT_COMPLETED', {
      attemptId: attempt._id,
      score: attempt.result.totalScore,
    });
  }

  return attempt;
}

async function startAssessment(candidateProfile, requestedSkills) {
  const existing = await AssessmentAttempt.findOne({ candidate: candidateProfile._id, status: 'in_progress' });
  if (existing) {
    throw new ApiError(409, 'You already have an assessment in progress', { attemptId: existing._id });
  }

  const availableSkills = candidateProfile.skills || [];
  if (availableSkills.length === 0) {
    throw new ApiError(400, 'Upload and analyze a resume first so we can detect your skills');
  }

  let baseSkills = requestedSkills && requestedSkills.length > 0 ? requestedSkills : availableSkills;
  baseSkills = baseSkills.filter((s) => availableSkills.includes(s));
  if (baseSkills.length === 0) {
    throw new ApiError(400, 'Selected skills must be present on your resume');
  }

  // Personalize the pool: pull in extra skills implied by the candidate's
  // stated area of interest / career objective / certifications, even if
  // those skills weren't explicitly detected on the resume, plus always
  // consider the skill-independent Aptitude category.
  // Cross-attempt history: every question ever served to this candidate in
  // any earlier attempt (there is no in_progress one at this point — see
  // the guard above) is excluded for the life of this attempt too, so
  // nothing repeats across separate assessment attempts. Fetched alongside
  // the resume since the two lookups are independent.
  const [resume, priorHistoryQuestionIds] = await Promise.all([
    candidateProfile.resume ? Resume.findById(candidateProfile.resume).select('parsed.certifications') : null,
    AssessmentAttempt.find({ candidate: candidateProfile._id }).distinct('askedQuestionIds'),
  ]);
  const certificationsText = (resume?.parsed?.certifications || []).join(' ');
  const interestText = [candidateProfile.areaOfInterest, candidateProfile.careerObjective, certificationsText]
    .filter(Boolean)
    .join(' ');
  const interestDerivedSkills = extractSkills(interestText).filter((s) => !baseSkills.includes(s));

  const candidateSkillPool = [...baseSkills, ...interestDerivedSkills];
  const skillsToCheck = [...candidateSkillPool, APTITUDE_PSEUDO_SKILL];

  const questionCounts = await Question.aggregate([
    { $match: { skill: { $in: skillsToCheck }, isActive: true } },
    { $group: { _id: '$skill', count: { $sum: 1 } } },
  ]);
  const skillsWithQuestions = new Set(questionCounts.filter((q) => q.count > 0).map((q) => q._id));

  let skills = candidateSkillPool.filter((s) => skillsWithQuestions.has(s));
  if (skills.length === 0) {
    throw new ApiError(400, 'No assessment questions are available yet for your detected skills');
  }
  if (skillsWithQuestions.has(APTITUDE_PSEUDO_SKILL)) {
    skills = [...skills, APTITUDE_PSEUDO_SKILL];
  }

  const totalQuestions = Math.min(skills.length * QUESTIONS_PER_SKILL, MAX_TOTAL_QUESTIONS);
  const skillState = {};
  for (const skill of skills) skillState[skill] = initialSkillState();

  const attempt = await AssessmentAttempt.create({
    candidate: candidateProfile._id,
    skills,
    status: 'in_progress',
    startTime: new Date(),
    timeLimitSeconds: totalQuestions * SECONDS_PER_QUESTION,
    totalQuestions,
    askedQuestionIds: [],
    priorHistoryQuestionIds,
    skillState,
    personalizationContext: {
      resumeSkills: baseSkills,
      interestDerivedSkills,
      areaOfInterest: candidateProfile.areaOfInterest || '',
      careerObjective: candidateProfile.careerObjective || '',
      experienceLevel: candidateProfile.experienceLevel || '',
    },
  });

  // Try every selected skill for the opening question, not just the
  // first — a candidate's earlier attempts may have already exhausted the
  // bank for whichever skill happens to be first in the list, even though
  // other selected skills still have fresh questions available.
  const startExcludeIds = combinedExcludeIds(attempt);
  let question = null;
  for (const skill of skills) {
    question = await selectNextQuestion({ skill, difficulty: 'Easy', excludeIds: startExcludeIds });
    if (question) break;
  }
  if (!question) {
    attempt.status = 'terminated';
    attempt.terminationReason = 'No questions available';
    await attempt.save();
    throw new ApiError(
      409,
      "You've already answered every available question for these skills in past attempts. Try selecting different skills, or check back once more questions are added."
    );
  }

  syncStateToServedQuestion(attempt, question);
  attempt.currentQuestionId = question._id;
  attempt.currentQuestionIssuedAt = new Date();
  attempt.askedQuestionIds.push(question._id);
  await attempt.save();

  await logActivity(candidateProfile.user?._id || candidateProfile.user, 'ASSESSMENT_STARTED', {
    attemptId: attempt._id,
    skills,
  });

  return {
    attempt,
    question: sanitizeQuestion(question, { questionNumber: 1, totalQuestions }),
  };
}

async function getCurrentQuestion(attemptId, candidateId) {
  const attempt = await loadOwnedAttempt(attemptId, candidateId);

  if (attempt.status !== 'in_progress') {
    throw new ApiError(409, `Assessment is ${attempt.status}`, { status: attempt.status });
  }

  if (isExpired(attempt)) {
    await finalizeAttempt(attempt, { status: 'completed', terminationReason: 'Time limit reached' });
    throw new ApiError(410, 'Time limit reached — assessment has been submitted automatically', {
      status: 'completed',
      attemptId: attempt._id,
    });
  }

  if (!attempt.currentQuestionId) {
    throw new ApiError(409, 'No active question for this assessment');
  }

  const question = await Question.findById(attempt.currentQuestionId);
  const deadline = attempt.startTime.getTime() + attempt.timeLimitSeconds * 1000;

  return sanitizeQuestion(question, {
    questionNumber: attempt.askedQuestionIds.length,
    totalQuestions: attempt.totalQuestions,
    timeRemainingSeconds: Math.max(0, Math.round((deadline - Date.now()) / 1000)),
  });
}

async function submitAnswer(attemptId, candidateId, submittedAnswer) {
  const attempt = await loadOwnedAttempt(attemptId, candidateId);

  if (attempt.status !== 'in_progress') {
    throw new ApiError(409, `Assessment is ${attempt.status}`);
  }
  if (isExpired(attempt)) {
    await finalizeAttempt(attempt, { status: 'completed', terminationReason: 'Time limit reached' });
    return { finished: true, result: attempt.result, reason: 'time_expired' };
  }
  if (!attempt.currentQuestionId) {
    throw new ApiError(409, 'No active question to answer');
  }

  const question = await Question.findById(attempt.currentQuestionId);
  if (!question) throw new ApiError(404, 'Question not found');

  const isCorrect =
    String(submittedAnswer ?? '').trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
  const timeTakenMs = Date.now() - attempt.currentQuestionIssuedAt.getTime();

  try {
    await AssessmentAnswer.create({
      attempt: attempt._id,
      question: question._id,
      skill: question.skill,
      difficulty: question.difficulty,
      submittedAnswer: String(submittedAnswer ?? ''),
      isCorrect,
      timeTakenMs,
      questionIndex: attempt.askedQuestionIds.length,
    });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'This question has already been answered');
    throw err;
  }

  const skillState = attempt.skillState[question.skill] || initialSkillState();
  attempt.skillState[question.skill] = nextSkillState(skillState, isCorrect);
  attempt.markModified('skillState');

  if (attempt.askedQuestionIds.length >= attempt.totalQuestions) {
    await finalizeAttempt(attempt, { status: 'completed' });
    return { finished: true, result: attempt.result };
  }

  const nextSkill = attempt.skills[attempt.askedQuestionIds.length % attempt.skills.length];
  const nextState = attempt.skillState[nextSkill] || initialSkillState();

  const excludeIds = combinedExcludeIds(attempt);
  let nextQuestion = await selectNextQuestion({
    skill: nextSkill,
    difficulty: nextState.difficulty,
    excludeIds,
  });

  if (!nextQuestion) {
    for (const skill of attempt.skills) {
      const state = attempt.skillState[skill] || initialSkillState();
      nextQuestion = await selectNextQuestion({ skill, difficulty: state.difficulty, excludeIds });
      if (nextQuestion) break;
    }
  }

  if (!nextQuestion) {
    await finalizeAttempt(attempt, { status: 'completed', terminationReason: 'Question bank exhausted' });
    return { finished: true, result: attempt.result };
  }

  syncStateToServedQuestion(attempt, nextQuestion);
  attempt.currentQuestionId = nextQuestion._id;
  attempt.currentQuestionIssuedAt = new Date();
  attempt.askedQuestionIds.push(nextQuestion._id);
  await attempt.save();

  return {
    finished: false,
    question: sanitizeQuestion(nextQuestion, {
      questionNumber: attempt.askedQuestionIds.length,
      totalQuestions: attempt.totalQuestions,
    }),
  };
}

async function recordViolation(attemptId, candidateId, type) {
  const TestViolation = require('../models/TestViolation');
  const attempt = await loadOwnedAttempt(attemptId, candidateId);

  if (attempt.status !== 'in_progress') {
    return { terminated: attempt.status === 'terminated', warningCount: attempt.violations.warnings, maxWarnings: MAX_WARNINGS };
  }

  await TestViolation.create({
    attempt: attempt._id,
    candidate: candidateId,
    type,
    questionIndex: attempt.askedQuestionIds.length,
  });

  if (type === 'tab_switch') attempt.violations.tabSwitches += 1;
  if (type === 'window_blur') attempt.violations.windowBlur += 1;
  if (type === 'fullscreen_exit') attempt.violations.fullscreenExits += 1;

  let terminated = false;
  if (HARD_VIOLATION_TYPES.has(type)) {
    attempt.violations.warnings += 1;
    if (attempt.violations.warnings >= MAX_WARNINGS) {
      await finalizeAttempt(attempt, { status: 'terminated', terminationReason: 'Repeated integrity violations' });
      terminated = true;
    } else {
      await attempt.save();
    }
  } else {
    await attempt.save();
  }

  return { terminated, warningCount: attempt.violations.warnings, maxWarnings: MAX_WARNINGS };
}

async function finishAssessment(attemptId, candidateId) {
  const attempt = await loadOwnedAttempt(attemptId, candidateId);
  if (attempt.status !== 'in_progress') {
    return attempt;
  }
  return finalizeAttempt(attempt, { status: 'completed' });
}

async function getResult(attemptId, candidateId) {
  const attempt = await loadOwnedAttempt(attemptId, candidateId);
  if (attempt.status === 'in_progress') {
    throw new ApiError(409, 'Assessment is still in progress');
  }
  return attempt;
}

module.exports = {
  startAssessment,
  getCurrentQuestion,
  submitAnswer,
  recordViolation,
  finishAssessment,
  getResult,
  loadOwnedAttempt,
};
