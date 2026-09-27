import { Link } from 'react-router-dom';

const STEPS = [
  { title: 'Build your profile', text: 'Create an account, add your background, and upload your resume.' },
  { title: 'Prove your skills', text: 'Get a real ATS score and take adaptive skill assessments.' },
  { title: 'Get discovered', text: 'Recruiters search, filter, and evaluate candidates using verified data.' },
];

export default function Landing() {
  return (
    <div>
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="auth-logo">
            <span className="dot" /> Hirevion
          </div>
          <nav className="landing-nav-links">
            <Link to="/login">Log in</Link>
            <Link to="/register?role=candidate" className="btn btn-primary btn-sm">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <h1>Build your profile. Prove your skills. Get discovered.</h1>
        <p>
          Hirevion connects job seekers with MNCs, startups, and hiring teams through real resume analysis,
          adaptive skill assessments, and verified candidate data — no guesswork.
        </p>
        <div className="landing-cta-row">
          <Link to="/register?role=candidate" className="btn btn-primary">
            Create Candidate Account
          </Link>
          <Link to="/register?role=recruiter" className="btn btn-secondary">
            Join as Recruiter
          </Link>
        </div>
      </section>

      <section className="landing-section">
        <h2>How it works</h2>
        <div className="grid grid-cols-3">
          {STEPS.map((s, i) => (
            <div className="card" key={s.title}>
              <span className="badge">Step {i + 1}</span>
              <h3 style={{ marginTop: 12 }}>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="grid grid-cols-2">
          <div className="card">
            <h3>For Candidates</h3>
            <p>
              Upload your resume for a real, measurable ATS score. See exactly which sections are weak, get
              your technical skills detected automatically, and take adaptive assessments that get harder as
              you prove yourself.
            </p>
          </div>
          <div className="card">
            <h3>For Recruiters</h3>
            <p>
              Search and filter candidates by skill, location, experience, ATS score, and assessment
              performance. View a verified profile, resume, and platform-generated candidate overview — you
              make the final call.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="grid grid-cols-3">
          <div className="card">
            <h3>Resume ATS</h3>
            <p>Real parsing of PDF/DOCX resumes with section-by-section scoring and specific recommendations.</p>
          </div>
          <div className="card">
            <h3>Skill Assessment</h3>
            <p>Adaptive-difficulty tests generated from the skills actually found in your resume.</p>
          </div>
          <div className="card">
            <h3>Candidate Discovery</h3>
            <p>Recruiters find relevant candidates fast with server-side search, filters, and pagination.</p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="card">
          <h3>Security</h3>
          <p>
            Passwords are hashed, sessions use HTTP-only cookies, uploads are validated by type and size, and
            assessment answers and timers are always verified on the server — never trusted from the browser.
          </p>
        </div>
      </section>

      <section className="landing-section landing-cta-final">
        <h2>Ready to get started?</h2>
        <div className="landing-cta-row">
          <Link to="/register?role=candidate" className="btn btn-primary">
            Create Candidate Account
          </Link>
          <Link to="/register?role=recruiter" className="btn btn-secondary">
            Join as Recruiter
          </Link>
        </div>
      </section>

      <footer className="landing-footer">© {new Date().getFullYear()} Hirevion</footer>
    </div>
  );
}
