import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as connectionService from '../../services/connectionService';
import { useToast } from '../../context/ToastContext';
import Avatar from '../../components/Avatar';
import Spinner from '../../components/Spinner';
import { STATUS_LABELS, STATUS_BADGE_CLASS, formatSlot, detectTimezone } from '../../utils/connectionStatus';

function emptySlot() {
  return { date: '', startTime: '', timezone: detectTimezone() };
}

export default function CandidateConnectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [connection, setConnection] = useState(undefined);
  const [error, setError] = useState('');
  const [slots, setSlots] = useState([emptySlot()]);
  const [message, setMessage] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const res = await connectionService.getConnection(id);
      setConnection(res.data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateSlot = (index, field) => (e) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: e.target.value } : s)));
  };
  const addSlot = () => setSlots((prev) => [...prev, emptySlot()]);
  const removeSlot = (index) => setSlots((prev) => prev.filter((_, i) => i !== index));

  const handleSubmitAvailability = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await connectionService.submitAvailability(id, slots, message);
      toast.success('Availability submitted');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setSubmitting(true);
    try {
      await connectionService.declineConnection(id, declineReason);
      toast.success('Connection request declined');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      await connectionService.cancelConnection(id, '');
      toast.success('Interview cancelled');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (error && connection === undefined) return <div className="alert alert-error">{error}</div>;
  if (connection === undefined) return <div className="skeleton" style={{ height: 300 }} />;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <Avatar photoFilename={connection.company?.logo} name={connection.company?.name || connection.recruiter?.fullName} size={56} kind="logo" />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0 }}>{connection.company?.name || connection.recruiter?.fullName}</h1>
          <p style={{ margin: 0 }}>
            {connection.recruiter?.fullName}
            {connection.company?.location ? ` · ${connection.company.location}` : ''}
          </p>
        </div>
        <span className={`badge ${STATUS_BADGE_CLASS[connection.status]}`}>{STATUS_LABELS[connection.status]}</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {connection.message && (
        <div className="card">
          <h3>Message from the recruiter</h3>
          <p style={{ margin: 0 }}>{connection.message}</p>
        </div>
      )}

      {connection.status === 'pending' && !showDecline && (
        <form className="card" style={{ marginTop: 24 }} onSubmit={handleSubmitAvailability}>
          <h3>Provide your availability</h3>
          <p>Add one or more times when you could interview (each interview is 1 hour). The recruiter will confirm one.</p>

          {slots.map((slot, i) => (
            <div className="slot-row" key={i}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Date</label>
                <input type="date" required value={slot.date} onChange={updateSlot(i, 'date')} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Time</label>
                <input type="time" required value={slot.startTime} onChange={updateSlot(i, 'startTime')} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Time zone</label>
                <input required value={slot.timezone} onChange={updateSlot(i, 'timezone')} placeholder="e.g. Asia/Kolkata" />
              </div>
              {slots.length > 1 && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeSlot(i)}>
                  Remove
                </button>
              )}
            </div>
          ))}

          <button type="button" className="btn btn-secondary btn-sm" onClick={addSlot} style={{ marginBottom: 16 }}>
            + Add another slot
          </button>

          <div className="field">
            <label>Message (optional)</label>
            <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner /> : 'Submit Availability'}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setShowDecline(true)} disabled={submitting}>
              Decline
            </button>
          </div>
        </form>
      )}

      {connection.status === 'pending' && showDecline && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>Decline this connection request?</h3>
          <div className="field">
            <label>Reason (optional)</label>
            <textarea rows={2} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-danger" onClick={handleDecline} disabled={submitting}>
              {submitting ? <Spinner /> : 'Confirm decline'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowDecline(false)} disabled={submitting}>
              Back
            </button>
          </div>
        </div>
      )}

      {connection.status === 'availability_submitted' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>Your submitted availability</h3>
          <ul className="bullet-list">
            {connection.availabilitySlots.map((s) => (
              <li key={s._id}>{formatSlot(s)}</li>
            ))}
          </ul>
          {connection.candidateMessage && <p>Your message: {connection.candidateMessage}</p>}
          <p>Waiting for the recruiter to confirm a time.</p>
        </div>
      )}

      {connection.status === 'scheduled' && (
        <div className="meeting-box" style={{ marginTop: 24 }}>
          <h3>Interview scheduled</h3>
          <p>
            <strong>{formatSlot(connection.selectedSlot)}</strong>
          </p>
          <p>{connection.meeting?.title}</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <a href={connection.meeting?.meetingLink} target="_blank" rel="noreferrer" className="btn btn-primary">
              Join Interview
            </a>
            <button className="btn btn-secondary" onClick={handleCancel} disabled={submitting}>
              Cancel Interview
            </button>
          </div>
        </div>
      )}

      {connection.status === 'completed' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>Interview completed</h3>
          <p>{formatSlot(connection.selectedSlot)}</p>
        </div>
      )}

      {connection.status === 'cancelled' && (
        <div className="alert alert-error" style={{ marginTop: 24 }}>
          This connection was cancelled by {connection.cancelledBy}.{connection.cancelReason ? ` Reason: ${connection.cancelReason}` : ''}
        </div>
      )}

      <button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={() => navigate('/candidate/connections')}>
        Back to connections
      </button>
    </div>
  );
}
