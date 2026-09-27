import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as authService from '../services/authService';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/Spinner';

const EXPERIENCE_LEVELS = ['Fresher', '0-1 years', '1-3 years', '3-5 years', '5-10 years', '10+ years'];
const COMPANY_TYPES = ['MNC', 'Startup', 'Product Company', 'Service Company', 'Other'];

const emptyCandidate = {
  fullName: '',
  email: '',
  mobile: '',
  location: '',
  dateOfBirth: '',
  highestEducation: '',
  experienceLevel: 'Fresher',
  currentRole: '',
  preferredRole: '',
  preferredLocation: '',
  yearsOfExperience: '',
};

const emptyRecruiter = {
  fullName: '',
  email: '',
  phone: '',
  companyName: '',
  companyWebsite: '',
  companyType: 'Startup',
  companyLocation: '',
  companyDescription: '',
};

export default function Register() {
  const [params] = useSearchParams();
  const initialRole = params.get('role') === 'recruiter' ? 'recruiter' : 'candidate';
  const [role, setRole] = useState(initialRole);
  const [candidate, setCandidate] = useState(emptyCandidate);
  const [recruiter, setRecruiter] = useState(emptyRecruiter);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const updateCandidate = (key) => (e) => setCandidate((c) => ({ ...c, [key]: e.target.value }));
  const updateRecruiter = (key) => (e) => setRecruiter((r) => ({ ...r, [key]: e.target.value }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return setPhoto(null);
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be 2MB or smaller');
      e.target.value = '';
      return;
    }
    setPhoto(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);

    const formData = new FormData();
    formData.append('role', role);

    if (role === 'candidate') {
      Object.entries(candidate).forEach(([k, v]) => formData.append(k, v));
      if (photo) formData.append('profilePhoto', photo);
    } else {
      Object.entries(recruiter).forEach(([k, v]) => formData.append(k, v));
      if (photo) formData.append('companyLogo', photo);
    }

    try {
      if (role === 'candidate') {
        await authService.registerCandidate(formData);
      } else {
        await authService.registerRecruiter(formData);
      }
      setDone(true);
      toast.success('Account created. Check your email for your temporary password.');
    } catch (err) {
      setError(err.message);
      if (err.details) {
        const fe = {};
        err.details.forEach((d) => {
          if (d.field) fe[d.field] = d.message;
        });
        setFieldErrors(fe);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>Check your email</h2>
            <p>
              We&apos;ve sent a temporary password to your inbox. Use it to log in, then you&apos;ll be asked to
              set a permanent password.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/login')}>
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card wide">
        <div className="auth-logo">
          <span className="dot" /> Hirevion
        </div>
        <div className="card">
          <div className="role-toggle">
            <button
              type="button"
              className={`role-toggle-btn ${role === 'candidate' ? 'active' : ''}`}
              onClick={() => setRole('candidate')}
            >
              Candidate
            </button>
            <button
              type="button"
              className={`role-toggle-btn ${role === 'recruiter' ? 'active' : ''}`}
              onClick={() => setRole('recruiter')}
            >
              Recruiter
            </button>
          </div>

          <h2>{role === 'candidate' ? 'Create your candidate account' : 'Join as a recruiter'}</h2>
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {role === 'candidate' ? (
              <>
                <div className="form-row">
                  <div className="field">
                    <label>Full name</label>
                    <input required value={candidate.fullName} onChange={updateCandidate('fullName')} />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input type="email" required value={candidate.email} onChange={updateCandidate('email')} />
                    {fieldErrors.email && <div className="error">{fieldErrors.email}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Mobile number</label>
                    <input required value={candidate.mobile} onChange={updateCandidate('mobile')} placeholder="+919876543210" />
                    {fieldErrors.mobile && <div className="error">{fieldErrors.mobile}</div>}
                  </div>
                  <div className="field">
                    <label>Location</label>
                    <input required value={candidate.location} onChange={updateCandidate('location')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Date of birth (optional)</label>
                    <input type="date" value={candidate.dateOfBirth} onChange={updateCandidate('dateOfBirth')} />
                  </div>
                  <div className="field">
                    <label>Profile photo</label>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhoto} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Highest education</label>
                    <input value={candidate.highestEducation} onChange={updateCandidate('highestEducation')} />
                  </div>
                  <div className="field">
                    <label>Experience level</label>
                    <select value={candidate.experienceLevel} onChange={updateCandidate('experienceLevel')}>
                      {EXPERIENCE_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Current role</label>
                    <input value={candidate.currentRole} onChange={updateCandidate('currentRole')} />
                  </div>
                  <div className="field">
                    <label>Preferred job role</label>
                    <input value={candidate.preferredRole} onChange={updateCandidate('preferredRole')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Preferred location</label>
                    <input value={candidate.preferredLocation} onChange={updateCandidate('preferredLocation')} />
                  </div>
                  <div className="field">
                    <label>Years of experience</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={candidate.yearsOfExperience}
                      onChange={updateCandidate('yearsOfExperience')}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="form-row">
                  <div className="field">
                    <label>Your full name</label>
                    <input required value={recruiter.fullName} onChange={updateRecruiter('fullName')} />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input type="email" required value={recruiter.email} onChange={updateRecruiter('email')} />
                    {fieldErrors.email && <div className="error">{fieldErrors.email}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Phone number</label>
                    <input required value={recruiter.phone} onChange={updateRecruiter('phone')} placeholder="+919876543210" />
                    {fieldErrors.phone && <div className="error">{fieldErrors.phone}</div>}
                  </div>
                  <div className="field">
                    <label>Company name</label>
                    <input required value={recruiter.companyName} onChange={updateRecruiter('companyName')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Company website</label>
                    <input value={recruiter.companyWebsite} onChange={updateRecruiter('companyWebsite')} placeholder="https://" />
                  </div>
                  <div className="field">
                    <label>Company type</label>
                    <select value={recruiter.companyType} onChange={updateRecruiter('companyType')}>
                      {COMPANY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Company location</label>
                    <input value={recruiter.companyLocation} onChange={updateRecruiter('companyLocation')} />
                  </div>
                  <div className="field">
                    <label>Company logo</label>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhoto} />
                  </div>
                </div>
                <div className="field">
                  <label>Company description</label>
                  <textarea
                    rows={3}
                    value={recruiter.companyDescription}
                    onChange={updateRecruiter('companyDescription')}
                  />
                </div>
              </>
            )}

            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? <Spinner /> : 'Create account'}
            </button>
          </form>
        </div>
        <div className="auth-footer-link">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
