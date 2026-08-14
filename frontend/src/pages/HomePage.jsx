import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import Footer from '../components/Footer';
import Reveal from '../components/landing/Reveal';
import DashboardPreview from '../components/landing/DashboardPreview';
import PriceCounter from '../components/landing/PriceCounter';
import RecommendationCard from '../components/landing/RecommendationCard';
import FaqAccordion from '../components/landing/FaqAccordion';
import AiNetworkHero from '../components/landing/AiNetworkHero';
import { useCountUp } from '../hooks/useScrollReveal';
import { useMagneticHover } from '../hooks/useMagneticHover';
import { TargetIcon, BoltIcon, ChartIcon, BrainIcon, SearchIcon, ClockIcon, TrendUpIcon, StarIcon, ArrowRightIcon } from '../components/landing/icons';

const navLinks = [
  { label: 'Why TutorMind', href: 'why-tutormind' },
  { label: 'Subjects', href: 'subjects-section' },
  { label: 'How it works', href: 'how-it-works' },
  { label: 'Pricing', href: 'pricing-section' },
  { label: 'FAQ', href: 'faq-section' },
];

const trustIndicators = [
  { label: 'Built for NEET, JEE & KCET', Icon: TargetIcon },
  { label: 'No credit card required', Icon: BoltIcon },
  { label: 'Practice-first, not video-first', Icon: ChartIcon },
];

const pillars = [
  {
    title: 'Adaptive practice engine',
    copy: 'Every attempt updates a live model of your strengths, so the next question is always the right level of challenge — not too easy, not demoralizing.',
    Icon: BrainIcon,
  },
  {
    title: 'Weak-topic detection',
    copy: 'TutorMind watches accuracy and time-per-question across every subject to surface exactly where you\u2019re losing marks, before the exam does.',
    Icon: SearchIcon,
  },
  {
    title: 'Exam-day simulation',
    copy: 'Full-length, negative-marking-aware mock tests that mirror real NEET/JEE/KCET timing, so exam day feels like just another practice session.',
    Icon: ClockIcon,
  },
  {
    title: 'Actionable analytics',
    copy: 'No vanity charts — every insight comes with a next step: which topic to revise, which question type to drill, and when to retest.',
    Icon: TrendUpIcon,
  },
];

const subjects = [
  {
    exam: 'NEET',
    focus: 'Biology, Physics & Chemistry',
    detail: 'NCERT-aligned question banks with diagram-heavy Botany & Zoology coverage.',
  },
  {
    exam: 'JEE',
    focus: 'Physics, Chemistry & Mathematics',
    detail: 'Concept-linked problem sets from JEE Main difficulty up through Advanced-style multi-step problems.',
  },
  {
    exam: 'KCET / CET',
    focus: 'PCM/PCB tracks',
    detail: 'State-syllabus-matched practice for Karnataka CET aspirants, alongside NEET/JEE prep.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Practice questions',
    copy: 'Start with a diagnostic set or jump straight into a subject and topic you want to drill.',
  },
  {
    step: '02',
    title: 'System analyzes performance',
    copy: 'Accuracy, timing, and attempt patterns are scored after every question — not just at the end of a test.',
  },
  {
    step: '03',
    title: 'Get personalized recommendations',
    copy: 'Your next practice set adapts automatically, prioritizing the topics most likely to move your score.',
  },
];

// Placeholder testimonials — swap in real student quotes before launch.
const testimonials = [
  {
    quote:
      'The weak-topic breakdown told me Organic Chemistry was quietly costing me marks weeks before I noticed it myself.',
    name: 'A. Sharma',
    role: 'NEET aspirant',
  },
  {
    quote:
      'Exam simulation mode is the closest thing to the real JEE timing pressure I found while prepping from home.',
    name: 'R. Patel',
    role: 'JEE aspirant',
  },
  {
    quote:
      'I stopped guessing what to revise. The recommendations just tell me what to practice next.',
    name: 'K. Nair',
    role: 'KCET aspirant',
  },
];

// Placeholder pricing — replace with real plans/currency before launch.
const pricingPlans = [
  {
    name: 'Free',
    priceValue: 0,
    period: 'forever',
    tagline: 'Get started and see how adaptive practice feels.',
    features: ['Daily practice sets', 'Basic performance tracking', '1 exam simulation / month'],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Pro',
    priceValue: 499,
    period: '/ month',
    tagline: 'For students actively preparing for an upcoming exam.',
    features: [
      'Unlimited adaptive practice',
      'Full weak-topic analytics',
      'Unlimited exam simulations',
      'Priority recommendation refresh',
    ],
    cta: 'Start Pro trial',
    highlighted: true,
  },
  {
    name: 'Premium',
    priceValue: 999,
    period: '/ month',
    tagline: 'Maximum support for the final exam stretch.',
    features: ['Everything in Pro', 'Deep-dive performance reports', 'Custom revision roadmap'],
    cta: 'Go Premium',
    highlighted: false,
  },
];

const faqs = [
  {
    question: 'Which exams does TutorMind cover?',
    answer:
      'TutorMind is built specifically for NEET, JEE (Main-style), and Karnataka CET preparation, with subject coverage across Physics, Chemistry, Mathematics, and Biology.',
  },
  {
    question: 'How does the recommendation engine decide what to show me next?',
    answer:
      'Every attempt updates a per-topic performance profile — accuracy, time taken, and recency. The system prioritizes topics where you\u2019re both weak and due for review, instead of repeating what you already know.',
  },
  {
    question: 'Is there a free plan?',
    answer:
      'Yes — the Free plan includes daily practice sets and basic performance tracking so you can try the adaptive experience before upgrading.',
  },
  {
    question: 'Can I cancel or change plans anytime?',
    answer:
      'Yes, plans are month-to-month and you can upgrade, downgrade, or cancel from your account settings at any time.',
  },
];

const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const authMode = searchParams.get('auth');
  const isAuthOpen = authMode === 'login' || authMode === 'register';

  const [busy, setBusy] = useState(false);
  const heroAccuracyValue = useCountUp(18, { duration: 1500 });
  const heroReadinessValue = useCountUp(78, { duration: 1700 });
  const heroCtaRef = useMagneticHover();
  const finalCtaRef = useMagneticHover();
  const [error, setError] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    targetExam: 'JEE',
  });

  const modeTitle = useMemo(() => {
    if (authMode === 'register') return 'Create your account';
    return 'Welcome back';
  }, [authMode]);

  const openAuth = (mode) => {
    const next = new URLSearchParams(searchParams);
    next.set('auth', mode);
    setSearchParams(next);
    setError('');
  };

  const closeAuth = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('auth');
    setSearchParams(next);
    setError('');
  };

  const scrollToSection = (id) => {
    const node = document.getElementById(id);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // pushState (not window.location.hash) so the URL reflects the section
    // without triggering the browser's own instant jump-to-anchor, which
    // would fight the smooth scroll above.
    if (window.history?.pushState) {
      window.history.pushState(null, '', `#${id}`);
    }
  };

  // Clicking the logo while already on "/" is otherwise a no-op for
  // react-router (same path, no navigation) — so it needs its own handler
  // to actually take you back to the very top of the hero.
  const scrollToTop = (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.history?.pushState) {
      window.history.pushState(null, '', '/');
    }
  };

  // Deep-link support: if someone lands on /#pricing-section directly
  // (shared link, refresh, back/forward), scroll to that section.
  useEffect(() => {
    const hash = window.location.hash?.slice(1);
    if (!hash) return;
    const node = document.getElementById(hash);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Navbar scroll-shadow + active-section highlighting, driven by one
  // shared scroll listener (rAF-throttled).
  //
  // The active section is picked as the LAST nav-linked section (in
  // document order) whose top edge has scrolled above the navbar — the
  // standard, height-agnostic scroll-spy algorithm. An earlier version used
  // a thin IntersectionObserver trigger band in the middle of the viewport,
  // which broke on short sections: scrolling to "Subjects" (a short
  // section) immediately filled that band with the next section's
  // ("How It Works") content, so the nav highlighted the wrong link.
  const [isNavScrolled, setIsNavScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  useEffect(() => {
    const sectionIds = navLinks.map((link) => link.href);
    const NAV_OFFSET = 96; // sticky navbar height + a little breathing room
    let frame = null;

    const measure = () => {
      frame = null;
      setIsNavScrolled(window.scrollY > 24);

      let current = '';
      for (const id of sectionIds) {
        const node = document.getElementById(id);
        if (!node) continue;
        if (node.getBoundingClientRect().top - NAV_OFFSET <= 0) {
          current = id;
        }
      }
      setActiveSection(current);
    };

    const handleScroll = () => {
      if (frame === null) {
        frame = requestAnimationFrame(measure);
      }
    };

    measure();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  const onLoginSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(loginForm);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const onRegisterSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(registerForm);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-noise" aria-hidden="true" />
      <header className={`landing-topbar ${isNavScrolled ? 'is-scrolled' : ''}`}>
        <BrandLogo className="landing-logo" to="/" onClick={scrollToTop} />

        <nav className="landing-nav">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={`#${link.href}`}
              className={activeSection === link.href ? 'is-active' : ''}
              onClick={(event) => {
                event.preventDefault();
                scrollToSection(link.href);
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="landing-actions">
          <button className="outline-btn" type="button" onClick={() => openAuth('login')}>
            Login
          </button>
          <button className="solid-btn" type="button" onClick={() => openAuth('register')}>
            Start free trial
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="hero-aurora" aria-hidden="true" />
        <div className="hero-grid-lines" aria-hidden="true" />
        <div className="hero-vignette" aria-hidden="true" />
        <div className="hero-dust" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, index) => (
            <span key={index} className="hero-dust-mote" />
          ))}
        </div>

        <div className="hero-content centered">
          <span className="hero-badge">AI-powered prep for NEET · JEE · KCET</span>
          <h1>AI that understands how you learn</h1>
          <p>
            TutorMind tracks every practice attempt, finds the topics quietly costing you marks,
            and builds your next session automatically — so you always know exactly what to
            practice next.
          </p>

          <div className="hero-cta-row">
            <button
              ref={heroCtaRef}
              className="solid-btn magnetic-btn btn-with-arrow"
              type="button"
              onClick={() => openAuth('register')}
            >
              Start Practicing
              <ArrowRightIcon className="btn-arrow" />
            </button>
            <button className="outline-btn" type="button" onClick={() => scrollToSection('how-it-works')}>
              See how it works
            </button>
          </div>

          <ul className="hero-trust-row">
            {trustIndicators.map((item) => (
              <li key={item.label}>
                <item.Icon className="hero-trust-icon" aria-hidden="true" />
                {item.label}
              </li>
            ))}
          </ul>

          <div className="hero-3d-stage" aria-hidden="true">
            <AiNetworkHero />
          </div>
        </div>

        <div className="hero-float-card hero-float-card-1" aria-hidden="true">
          <span className="hero-float-label">Weak topic found</span>
          <span className="hero-float-value">Thermodynamics</span>
        </div>
        <div className="hero-float-card hero-float-card-2" aria-hidden="true">
          <span className="hero-float-label">Accuracy this week</span>
          <span className="hero-float-value hero-float-value-up">+{heroAccuracyValue}%</span>
        </div>
        <div className="hero-float-card hero-float-card-3" aria-hidden="true">
          <span className="hero-float-label">Exam readiness</span>
          <span className="hero-float-value">{heroReadinessValue} / 100</span>
        </div>
        <RecommendationCard />
      </section>

      <section className="landing-section" id="why-tutormind">
        <Reveal as="h2">Why TutorMind</Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={60}>
          Every practice session is analyzed to improve exam-readiness with actionable guidance —
          not just another question bank.
        </Reveal>
        <div className="pillar-grid">
          {pillars.map((pillar, index) => (
            <Reveal as="article" className="pillar-card" key={pillar.title} delay={index * 90}>
              <span className="pillar-icon" aria-hidden="true">
                <pillar.Icon />
              </span>
              <h3>{pillar.title}</h3>
              <p>{pillar.copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-split" id="ai-personalization">
        <Reveal as="div" className="split-copy">
          <span className="section-eyebrow">Personalized learning</span>
          <h2>A study plan that rewrites itself around you</h2>
          <p className="landing-section-subtext left">
            Instead of a fixed syllabus checklist, TutorMind keeps a live performance profile per
            topic — accuracy, response time, and how recently you practiced it — and uses that to
            decide what you see next.
          </p>
          <ul className="split-list">
            <li>Detects weak topics before a mock test does</li>
            <li>Prioritizes questions you're due to review</li>
            <li>Adjusts difficulty as you improve, automatically</li>
          </ul>
        </Reveal>
        <Reveal as="div" delay={120} className="split-visual">
          <DashboardPreview />
        </Reveal>
      </section>

      <section className="landing-section" id="subjects-section">
        <Reveal as="h2">Built for NEET, JEE, and KCET preparation</Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={60}>
          Pick your exam track — every question bank is mapped to the syllabus that matters for it.
        </Reveal>
        <div className="subject-grid">
          {subjects.map((subject, index) => (
            <Reveal as="article" className="subject-card" key={subject.exam} delay={index * 90}>
              <h3>{subject.exam}</h3>
              <span className="subject-focus">{subject.focus}</span>
              <p>{subject.detail}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <Reveal as="h2">How It Works</Reveal>
        <div className="steps-timeline">
          {steps.map((item, index) => (
            <Reveal as="article" className="step-card" key={item.step} delay={index * 100}>
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="testimonials-section">
        <Reveal as="h2">What students are saying</Reveal>
        <div className="testimonial-grid">
          {testimonials.map((item, index) => (
            <Reveal as="figure" className="testimonial-card" key={item.name} delay={index * 90}>
              <div className="testimonial-stars" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <StarIcon key={starIndex} />
                ))}
              </div>
              <blockquote>&ldquo;{item.quote}&rdquo;</blockquote>
              <figcaption>
                <span className="testimonial-avatar" aria-hidden="true">
                  {item.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </span>
                <span className="testimonial-meta">
                  <strong>{item.name}</strong>
                  <span>{item.role}</span>
                </span>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="pricing-section">
        <Reveal as="h2">Simple, transparent pricing</Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={60}>
          Start free. Upgrade when you're ready to go all-in on exam prep.
        </Reveal>
        <div className="pricing-grid">
          {pricingPlans.map((plan, index) => (
            <Reveal
              as="article"
              className={`pricing-card ${plan.highlighted ? 'pricing-card-highlight' : ''}`}
              key={plan.name}
              delay={index * 90}
            >
              {plan.highlighted && <span className="pricing-badge">Most popular</span>}
              <h3>{plan.name}</h3>
              <p className="pricing-price">
                <PriceCounter value={plan.priceValue} />
                <span>{plan.period}</span>
              </p>
              <p className="pricing-tagline">{plan.tagline}</p>
              <ul className="pricing-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                type="button"
                className={plan.highlighted ? 'solid-btn' : 'outline-btn'}
                onClick={() => openAuth('register')}
              >
                {plan.cta}
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="faq-section">
        <Reveal as="h2">Frequently asked questions</Reveal>
        <Reveal as="div" delay={80} className="faq-wrap">
          <FaqAccordion items={faqs} />
        </Reveal>
      </section>

      <Reveal as="section" className="landing-section cta-strip">
        <div className="cta-strip-glow" aria-hidden="true" />
        <h2>Start your smart preparation today</h2>
        <p className="landing-section-subtext">
          Join TutorMind and let your practice sessions tell you exactly what to study next.
        </p>
        <button
          ref={finalCtaRef}
          className="solid-btn magnetic-btn cta-pulse-btn btn-with-arrow"
          type="button"
          onClick={() => openAuth('register')}
        >
          Get Started Free
          <ArrowRightIcon className="btn-arrow" />
        </button>
      </Reveal>

      <div className="landing-footer-wrap">
        <Footer />
      </div>

      {isAuthOpen && (
        <section className="auth-overlay" onClick={closeAuth}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-modal-head">
              <h3>{modeTitle}</h3>
              <button type="button" className="outline-btn close-btn" onClick={closeAuth}>
                Close
              </button>
            </div>

            {authMode === 'login' ? (
              <form className="auth-modal-form" onSubmit={onLoginSubmit}>
                <input
                  type="email"
                  placeholder="Email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  required
                />
                {error && <div className="error-text">{error}</div>}
                <button className="solid-btn" type="submit" disabled={busy}>
                  {busy ? 'Logging in...' : 'Login'}
                </button>
                <small>
                  New user?{' '}
                  <Link to="/?auth=register" onClick={() => openAuth('register')}>
                    Create account
                  </Link>
                </small>
              </form>
            ) : (
              <form className="auth-modal-form" onSubmit={onRegisterSubmit}>
                <input
                  placeholder="Full Name"
                  value={registerForm.name}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
                <input
                  type="password"
                  placeholder="Password (min 6 chars)"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  required
                />
                <select
                  value={registerForm.targetExam}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, targetExam: event.target.value }))
                  }
                >
                  <option value="NEET">NEET</option>
                  <option value="JEE">JEE</option>
                  <option value="CET">CET</option>
                </select>
                {error && <div className="error-text">{error}</div>}
                <button className="solid-btn" type="submit" disabled={busy}>
                  {busy ? 'Registering...' : 'Create Account'}
                </button>
                <small>
                  Already have an account?{' '}
                  <Link to="/?auth=login" onClick={() => openAuth('login')}>
                    Login
                  </Link>
                </small>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;