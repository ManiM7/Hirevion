const Question = require('../models/Question');

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard', 'Expert'];
const STRUGGLE_STREAK_THRESHOLD = 3; // consecutive wrong answers at the same difficulty before backing off

function indexOf(difficulty) {
  return DIFFICULTY_ORDER.indexOf(difficulty);
}

/**
 * Core adaptive rule (spec section 13/47):
 *  - correct answer  -> move up one difficulty level (capped at Expert)
 *  - wrong answer     -> stay at the same difficulty
 *  - EXCEPT: after several consecutive wrong answers at the same
 *    difficulty, the candidate is "consistently struggling" and the
 *    engine backs off one level instead of holding forever.
 * Kept isolated from the controller so the rule can be tuned later
 * without touching request handling.
 */
function nextSkillState(skillState, wasCorrect) {
  const state = {
    difficulty: skillState.difficulty,
    correctStreak: skillState.correctStreak,
    wrongStreak: skillState.wrongStreak,
    correctCount: skillState.correctCount,
    wrongCount: skillState.wrongCount,
    highestDifficultyReached: skillState.highestDifficultyReached,
  };

  if (wasCorrect) {
    state.correctCount += 1;
    state.correctStreak += 1;
    state.wrongStreak = 0;

    const nextIdx = Math.min(indexOf(state.difficulty) + 1, DIFFICULTY_ORDER.length - 1);
    state.difficulty = DIFFICULTY_ORDER[nextIdx];
  } else {
    state.wrongCount += 1;
    state.wrongStreak += 1;
    state.correctStreak = 0;

    if (state.wrongStreak >= STRUGGLE_STREAK_THRESHOLD) {
      const prevIdx = Math.max(indexOf(state.difficulty) - 1, 0);
      state.difficulty = DIFFICULTY_ORDER[prevIdx];
      state.wrongStreak = 0;
    }
  }

  if (indexOf(state.difficulty) > indexOf(state.highestDifficultyReached)) {
    state.highestDifficultyReached = state.difficulty;
  }

  return state;
}

const VARIETY_POOL_SIZE = 5; // pick randomly among the N least-served matching questions

/**
 * Picks the next active question for a skill at the target difficulty that
 * this candidate has never been asked before (excludeIds covers both this
 * attempt and every prior attempt — see assessmentService). Falls back to
 * nearby difficulties (then any difficulty for the skill) so a thin
 * question bank never stalls an assessment.
 *
 * Among the matching candidates, it biases toward the least-served
 * questions platform-wide (rather than pure random) so that different
 * candidates tend to land on different questions instead of everyone
 * converging on the same popular ones — then increments the chosen
 * question's serve counter.
 */
async function selectNextQuestion({ skill, difficulty, excludeIds }) {
  const tryDifficulties = [
    difficulty,
    ...DIFFICULTY_ORDER.filter((d) => d !== difficulty).sort(
      (a, b) => Math.abs(indexOf(a) - indexOf(difficulty)) - Math.abs(indexOf(b) - indexOf(difficulty))
    ),
  ];

  for (const d of tryDifficulties) {
    const candidates = await Question.find({ skill, difficulty: d, isActive: true, _id: { $nin: excludeIds } })
      .sort({ timesServed: 1, _id: 1 })
      .limit(VARIETY_POOL_SIZE)
      .lean();

    if (candidates.length > 0) {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      // Variety counter only — not awaited, so it doesn't add a database round trip to every question.
      Question.updateOne({ _id: chosen._id }, { $inc: { timesServed: 1 } }).catch((err) =>
        console.error('[assessment] timesServed update failed:', err.message)
      );
      return chosen;
    }
  }

  return null;
}

module.exports = { DIFFICULTY_ORDER, nextSkillState, selectNextQuestion };
