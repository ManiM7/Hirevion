const { DateTime } = require('luxon');
const Connection = require('../models/Connection');
const CandidateProfile = require('../models/CandidateProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('./activityService');
const googleMeetService = require('./googleMeetService');

const ACTIVE_STATUSES_FOR_DUPLICATE_CHECK = ['pending', 'availability_submitted', 'scheduled'];
const INTERVIEW_DURATION_MINUTES = 60;

// Candidates pick a single time; the stored end time is derived from a fixed interview length.
function endTimeFor(startTime) {
  const start = DateTime.fromFormat(String(startTime || ''), 'HH:mm');
  return start.isValid ? start.plus({ minutes: INTERVIEW_DURATION_MINUTES }).toFormat('HH:mm') : '';
}

async function notify(userId, type, title, message, metadata = {}) {
  await Notification.create({ user: userId, type, title, message, metadata });
}

async function loadParticipants(connection) {
  const [candidateProfile, recruiterProfile] = await Promise.all([
    CandidateProfile.findById(connection.candidate).populate('user', 'email'),
    RecruiterProfile.findById(connection.recruiter).populate('user', 'email').populate('company'),
  ]);
  return { candidateProfile, recruiterProfile };
}

function isValidTimeZone(tz) {
  try {
    return DateTime.local().setZone(tz).isValid;
  } catch {
    return false;
  }
}

/** Converts a slot's wall-clock date/time + IANA timezone into precise UTC instants. */
function slotToInstants(slot) {
  if (!isValidTimeZone(slot.timezone)) {
    throw new ApiError(422, `Invalid time zone: ${slot.timezone}`);
  }
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(slot.date);
  const isoTime = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!isoDate || !isoTime.test(slot.startTime) || !isoTime.test(slot.endTime)) {
    throw new ApiError(422, 'Invalid date or time format');
  }

  const start = DateTime.fromISO(`${slot.date}T${slot.startTime}`, { zone: slot.timezone });
  let end = DateTime.fromISO(`${slot.date}T${slot.endTime}`, { zone: slot.timezone });

  if (!start.isValid || !end.isValid) {
    throw new ApiError(422, 'Invalid date/time value');
  }
  // A slot starting late in the evening ends after midnight, on the next day.
  if (end <= start) {
    end = end.plus({ days: 1 });
  }
  if (start < DateTime.now()) {
    throw new ApiError(422, 'Cannot schedule a slot in the past');
  }

  return { startAt: start.toJSDate(), endAt: end.toJSDate() };
}

/** Any other SCHEDULED connection for this candidate or recruiter that overlaps [startAt, endAt]. */
async function findOverlappingScheduled({ candidateId, recruiterId, startAt, endAt, excludeConnectionId }) {
  return Connection.findOne({
    _id: { $ne: excludeConnectionId },
    status: 'scheduled',
    $or: [{ candidate: candidateId }, { recruiter: recruiterId }],
    'selectedSlot.startAt': { $lt: endAt },
    'selectedSlot.endAt': { $gt: startAt },
  });
}

/** Scheduled interviews whose end time has passed are lazily flipped to completed. */
async function autoCompletePastInterviews(filter) {
  await Connection.updateMany(
    { ...filter, status: 'scheduled', 'selectedSlot.endAt': { $lt: new Date() } },
    { $set: { status: 'completed' } }
  );
}

async function createConnection(recruiterProfile, candidateId, message) {
  const candidateProfile = await CandidateProfile.findById(candidateId).populate('user', 'email');
  if (!candidateProfile) throw new ApiError(404, 'Candidate not found');

  const existing = await Connection.findOne({
    recruiter: recruiterProfile._id,
    candidate: candidateProfile._id,
    status: { $in: ACTIVE_STATUSES_FOR_DUPLICATE_CHECK },
  });
  if (existing) {
    throw new ApiError(409, 'You already have an active connection request with this candidate', {
      connectionId: existing._id,
    });
  }

  const connection = await Connection.create({
    recruiter: recruiterProfile._id,
    candidate: candidateProfile._id,
    company: recruiterProfile.company || null,
    message: message || '',
    status: 'pending',
  });

  await notify(
    candidateProfile.user._id,
    'CONNECTION_REQUEST',
    'New interview connection request',
    `${recruiterProfile.fullName}${recruiterProfile.company ? ` from ${recruiterProfile.company.name || 'a company'}` : ''} would like to connect with you.`,
    { connectionId: connection._id }
  );

  await logActivity(recruiterProfile.user, 'CONNECTION_REQUESTED', { connectionId: connection._id });

  return connection;
}

async function submitAvailability(connectionId, candidateProfile, slots, candidateMessage) {
  const connection = await Connection.findById(connectionId);
  if (!connection) throw new ApiError(404, 'Connection not found');
  if (String(connection.candidate) !== String(candidateProfile._id)) {
    throw new ApiError(403, 'This connection request does not belong to you');
  }
  if (!['pending', 'availability_submitted'].includes(connection.status)) {
    throw new ApiError(409, `Cannot submit availability while status is ${connection.status}`);
  }
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new ApiError(422, 'Provide at least one available time slot');
  }
  if (slots.length > 10) {
    throw new ApiError(422, 'Provide at most 10 time slots');
  }

  const normalizedSlots = slots.map((s) => ({
    date: s.date,
    startTime: s.startTime,
    endTime: endTimeFor(s.startTime),
    timezone: s.timezone,
  }));

  // Validate every slot up front (throws on the first invalid one).
  normalizedSlots.forEach(slotToInstants);

  connection.availabilitySlots = normalizedSlots;
  connection.candidateMessage = candidateMessage || '';
  connection.status = 'availability_submitted';
  await connection.save();

  const { recruiterProfile } = await loadParticipants(connection);
  await notify(
    recruiterProfile.user._id,
    'AVAILABILITY_SUBMITTED',
    `${candidateProfile.fullName} shared their availability`,
    `${candidateProfile.fullName} provided ${slots.length} available time slot(s) for an interview.`,
    { connectionId: connection._id }
  );

  await logActivity(candidateProfile.user, 'CONNECTION_AVAILABILITY_SUBMITTED', { connectionId: connection._id });

  return connection;
}

async function declineConnection(connectionId, candidateProfile, reason) {
  const connection = await Connection.findById(connectionId);
  if (!connection) throw new ApiError(404, 'Connection not found');
  if (String(connection.candidate) !== String(candidateProfile._id)) {
    throw new ApiError(403, 'This connection request does not belong to you');
  }
  if (!['pending', 'availability_submitted'].includes(connection.status)) {
    throw new ApiError(409, `Cannot decline while status is ${connection.status}`);
  }

  connection.status = 'cancelled';
  connection.cancelledBy = 'candidate';
  connection.cancelReason = reason || '';
  await connection.save();

  const { recruiterProfile } = await loadParticipants(connection);
  await notify(
    recruiterProfile.user._id,
    'CONNECTION_DECLINED',
    `${candidateProfile.fullName} declined your connection request`,
    reason ? `Reason: ${reason}` : 'No reason was given.',
    { connectionId: connection._id }
  );

  await logActivity(candidateProfile.user, 'CONNECTION_DECLINED', { connectionId: connection._id });

  return connection;
}

async function scheduleInterview(connectionId, recruiterProfile, slotId, title) {
  const connection = await Connection.findById(connectionId);
  if (!connection) throw new ApiError(404, 'Connection not found');
  if (String(connection.recruiter) !== String(recruiterProfile._id)) {
    throw new ApiError(403, 'This connection request does not belong to you');
  }
  if (connection.status !== 'availability_submitted') {
    throw new ApiError(409, `Cannot schedule while status is ${connection.status}`);
  }

  const slot = connection.availabilitySlots.id(slotId);
  if (!slot) throw new ApiError(404, 'That time slot was not found among the candidate\'s availability');

  const { startAt, endAt } = slotToInstants(slot);

  const conflict = await findOverlappingScheduled({
    candidateId: connection.candidate,
    recruiterId: connection.recruiter,
    startAt,
    endAt,
    excludeConnectionId: connection._id,
  });
  if (conflict) {
    throw new ApiError(409, 'This time slot overlaps with another already-scheduled interview for the candidate or recruiter');
  }

  const { candidateProfile, recruiterProfile: recruiterFull } = await loadParticipants(connection);
  const candidateEmail = candidateProfile?.user?.email;
  const recruiterEmail = recruiterFull?.user?.email;
  if (!candidateEmail || !recruiterEmail) {
    throw new ApiError(500, 'Could not resolve participant email addresses');
  }

  const meetingTitle = title?.trim() || `Interview: ${candidateProfile.fullName} × ${recruiterFull.company?.name || recruiterFull.fullName}`;

  const meeting = await googleMeetService.createMeetingEvent({
    summary: meetingTitle,
    description: `Interview scheduled via Hirevion between ${candidateProfile.fullName} (candidate) and ${recruiterFull.fullName} (recruiter)${recruiterFull.company ? ` at ${recruiterFull.company.name}` : ''}.`,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    timezone: slot.timezone,
    attendeeEmails: [candidateEmail, recruiterEmail],
  });

  connection.selectedSlot = {
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    timezone: slot.timezone,
    startAt,
    endAt,
  };
  connection.meeting = {
    provider: 'google_meet',
    meetingId: meeting.meetingId,
    meetingLink: meeting.meetingLink,
    htmlLink: meeting.htmlLink,
    title: meetingTitle,
  };
  connection.status = 'scheduled';
  await connection.save();

  const companyName = recruiterFull.company?.name || 'the recruiter';
  await notify(
    candidateProfile.user._id,
    'INTERVIEW_SCHEDULED',
    `Interview scheduled with ${companyName}`,
    `Your interview with ${recruiterFull.fullName} (${companyName}) is confirmed for ${slot.date} ${slot.startTime}–${slot.endTime} (${slot.timezone}).`,
    { connectionId: connection._id, meetingLink: meeting.meetingLink }
  );
  await notify(
    recruiterFull.user._id,
    'INTERVIEW_SCHEDULED',
    `Interview scheduled with ${candidateProfile.fullName}`,
    `Your interview with ${candidateProfile.fullName} is confirmed for ${slot.date} ${slot.startTime}–${slot.endTime} (${slot.timezone}).`,
    { connectionId: connection._id, meetingLink: meeting.meetingLink }
  );

  await logActivity(recruiterFull.user._id, 'INTERVIEW_SCHEDULED', { connectionId: connection._id });

  return connection;
}

async function cancelConnection(connectionId, actingUser, actingRole, reason) {
  const connection = await Connection.findById(connectionId);
  if (!connection) throw new ApiError(404, 'Connection not found');

  const profileField = actingRole === 'candidate' ? 'candidate' : 'recruiter';
  const ProfileModel = actingRole === 'candidate' ? CandidateProfile : RecruiterProfile;
  const ownProfile = await ProfileModel.findOne({ user: actingUser._id });
  if (!ownProfile || String(connection[profileField]) !== String(ownProfile._id)) {
    throw new ApiError(403, 'This connection does not belong to you');
  }
  if (!['pending', 'availability_submitted', 'scheduled'].includes(connection.status)) {
    throw new ApiError(409, `Cannot cancel while status is ${connection.status}`);
  }

  if (connection.status === 'scheduled' && connection.meeting?.meetingId) {
    await googleMeetService.deleteMeetingEvent(connection.meeting.meetingId);
  }

  connection.status = 'cancelled';
  connection.cancelledBy = actingRole;
  connection.cancelReason = reason || '';
  await connection.save();

  const { candidateProfile, recruiterProfile } = await loadParticipants(connection);
  const otherUserId = actingRole === 'candidate' ? recruiterProfile.user._id : candidateProfile.user._id;
  const actingName = actingRole === 'candidate' ? candidateProfile.fullName : recruiterProfile.fullName;
  await notify(
    otherUserId,
    'INTERVIEW_CANCELLED',
    'Interview cancelled',
    `${actingName} cancelled the interview.${reason ? ` Reason: ${reason}` : ''}`,
    { connectionId: connection._id }
  );

  await logActivity(actingUser._id, 'INTERVIEW_CANCELLED', { connectionId: connection._id });

  return connection;
}

async function listConnections(profile, role, statusFilter) {
  const field = role === 'candidate' ? 'candidate' : 'recruiter';
  const filter = { [field]: profile._id };
  await autoCompletePastInterviews(filter);

  if (statusFilter) filter.status = statusFilter;

  return Connection.find(filter)
    .sort({ updatedAt: -1 })
    .populate({ path: 'candidate', select: 'fullName profilePhoto currentRole location' })
    .populate({ path: 'recruiter', select: 'fullName' })
    .populate({ path: 'company', select: 'name logo type location' });
}

async function getConnectionDetail(connectionId, user) {
  const connection = await Connection.findById(connectionId)
    .populate({ path: 'candidate', select: 'fullName profilePhoto currentRole location skills' })
    .populate({ path: 'recruiter', select: 'fullName' })
    .populate({ path: 'company', select: 'name logo type location website' });
  if (!connection) throw new ApiError(404, 'Connection not found');

  await autoCompletePastInterviews({ _id: connection._id });
  if (connection.status === 'scheduled' && connection.selectedSlot?.endAt < new Date()) {
    connection.status = 'completed';
  }

  const [candidateProfile, recruiterProfile] = await Promise.all([
    CandidateProfile.findById(connection.candidate._id).select('user'),
    RecruiterProfile.findById(connection.recruiter._id).select('user'),
  ]);

  const isParticipant =
    String(candidateProfile.user) === String(user._id) || String(recruiterProfile.user) === String(user._id);
  if (!isParticipant) {
    throw new ApiError(403, 'You do not have access to this connection');
  }

  return connection;
}

module.exports = {
  createConnection,
  submitAvailability,
  declineConnection,
  scheduleInterview,
  cancelConnection,
  listConnections,
  getConnectionDetail,
};
