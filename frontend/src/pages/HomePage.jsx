import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <Link className="landing-logo" to="/">
          PrepAI
        </Link>

        <nav className="landing-nav">
          <a href="#">Product</a>
          <a href="#">Pricing</a>
          <a href="#">Company</a>
          <a href="#">Blog</a>
        </nav>

        <div className="landing-actions">
          <Link className="outline-btn" to="/login">
            Login
          </Link>
          <Link className="solid-btn" to="/register">
            Start free trial
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="hero-grid-lines" aria-hidden="true" />

        <div className="hero-badge">New: Personalized AI recommendations are live</div>

        <div className="hero-content centered">
          <h1>Think better with PrepAI</h1>
          <p>Never miss a concept, a mistake pattern, or your next high-value question set.</p>

          <div className="hero-cta-row">
            <Link className="solid-btn" to="/register">
              Start free trial
            </Link>
            <Link className="outline-btn" to="/login">
              Login
            </Link>
          </div>
        </div>

        <div className="horizon-wrap" aria-hidden="true">
          <div className="horizon-ring" />
          <div className="horizon-line" />
        </div>

        <div className="product-mockup" role="presentation">
          <div className="mockup-sidebar">
            <span className="mock-pill active">Daily notes</span>
            <span className="mock-pill">All notes</span>
            <span className="mock-pill">Tasks</span>
            <span className="mock-pill">Map</span>
          </div>

          <div className="mockup-main">
            <div className="mockup-search">Search anything...</div>
            <div className="mockup-content">
              <div className="mockup-text-block" />
              <div className="mockup-text-block short" />
              <div className="mockup-text-block" />
              <div className="mockup-text-block medium" />
              <div className="mockup-play">▶</div>
            </div>
          </div>

          <div className="mockup-calendar">
            <h4>April 2026</h4>
            <div className="calendar-grid">
              {Array.from({ length: 30 }).map((_, idx) => (
                <span key={idx} className={idx === 10 ? 'active' : ''}>
                  {idx + 1}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
