import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { user } = useAuth();

  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <div className="landing-logo">PrepAI Horizons</div>
        <nav className="landing-nav">
          <a href="#features">Features</a>
          <a href="#why">Why PrepAI</a>
          <a href="#cta">Get Started</a>
        </nav>
        <div className="landing-actions">
          <Link className="outline-btn" to="/login">
            Login
          </Link>
          <Link className="solid-btn" to={user ? '/dashboard' : '/register'}>
            {user ? 'Open Dashboard' : 'Start for Free'}
          </Link>
        </div>
      </header>

      <section className="landing-hero" id="cta">
        <div className="glow-columns" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="hero-content">
          <p className="hero-eyebrow">AI-Based Learning Platform for NEET, JEE, CET</p>
          <h1>Launch your exam prep strategy today</h1>
          <p>
            Build stronger concepts, detect weak topics early, and improve performance with
            data-driven practice plans and personalized recommendations.
          </p>
          <div className="hero-cta-row">
            <Link className="solid-btn" to={user ? '/dashboard' : '/register'}>
              {user ? 'Continue Learning' : 'Start for Free'}
            </Link>
            <Link className="outline-btn" to="/login">
              I already have an account
            </Link>
          </div>
          <small>No credit card required.</small>
        </div>
      </section>

      <section className="landing-showcase panel" id="features">
        <div className="showcase-copy">
          <h2>Create a high-impact preparation workflow</h2>
          <p>
            Practice by topic, track speed and accuracy, and use analytics to understand exactly
            where to focus next.
          </p>
          <div className="chip-wrap">
            <span className="chip">Adaptive Practice</span>
            <span className="chip">Weak Topic Alerts</span>
            <span className="chip">Live Progress Analytics</span>
          </div>
        </div>
        <div className="showcase-visual" id="why">
          <article className="mini-card">
            <h4>Accuracy Score</h4>
            <strong className="stat-good">82.4%</strong>
            <p>Consistent upward trend this week.</p>
          </article>
          <article className="mini-card">
            <h4>Weak Areas</h4>
            <strong className="stat-danger">2 Topics</strong>
            <p>Electrostatics, Organic Isomerism.</p>
          </article>
          <article className="mini-card">
            <h4>Recommended Next</h4>
            <p>Timed mixed practice set (20 questions).</p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
