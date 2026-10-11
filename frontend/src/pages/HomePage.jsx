import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import BrandLogo from '../components/BrandLogo';
import Footer from '../components/Footer';
import Reveal from '../components/landing/Reveal';
import DashboardPreview from '../components/landing/DashboardPreview';
import PriceCounter from '../components/landing/PriceCounter';
import RecommendationCard from '../components/landing/RecommendationCard';
import FaqAccordion from '../components/landing/FaqAccordion';
import AiNetworkHero from '../components/landing/AiNetworkHero';
import { useCountUp } from '../hooks/useScrollReveal';
import { useAuth } from '../context/AuthContext';
import { useTier } from '../context/TierContext';
import { resolvePricingAction } from '../utils/planSelection';
import { useMagneticHover } from '../hooks/useMagneticHover';
import { TargetIcon, BoltIcon, ChartIcon, BrainIcon, SearchIcon, ClockIcon, TrendUpIcon, StarIcon, ArrowRightIcon, MenuIcon, CloseIcon } from '../components/landing/icons';

// Anchor links (`href`) smooth-scroll within the landing page; the one
// route link (`to`) is a real React Router navigation to a separate page
// and is rendered as a <Link> instead of a scroll-spy anchor below.
const navLinks = [
  { labelKey: 'home.nav.why', href: 'why-tutormind' },
  { labelKey: 'home.nav.subjects', href: 'subjects-section' },
  { labelKey: 'navigation.aboutExam', to: '/about-exams' },
  { labelKey: 'home.nav.how', href: 'how-it-works' },
  { labelKey: 'home.nav.pricing', href: 'pricing-section' },
  { labelKey: 'home.nav.faq', href: 'faq-section' },
];

const trustIndicators = [
  { key: 'builtFor', Icon: TargetIcon },
  { key: 'noCard', Icon: BoltIcon },
  { key: 'practiceFirst', Icon: ChartIcon },
];

const pillars = [
  {
    key: 'adaptive',
    Icon: BrainIcon,
  },
  {
    key: 'weak',
    Icon: SearchIcon,
  },
  {
    key: 'sim',
    Icon: ClockIcon,
  },
  {
    key: 'analytics',
    Icon: TrendUpIcon,
  },
];

const subjects = [
  {
    exam: 'NEET',
    key: 'neet',
  },
  {
    exam: 'JEE',
    key: 'jee',
  },
  {
    exam: 'KCET / CET',
    key: 'cet',
  },
];

const steps = [
  {
    step: '01',
    key: 'practice',
  },
  {
    step: '02',
    key: 'analyze',
  },
  {
    step: '03',
    key: 'recommend',
  },
];

// Placeholder testimonials — swap in real student quotes before launch.
const testimonials = [
  {
    key: 'sharma',
    name: 'A. Sharma',
    exam: 'NEET',
  },
  {
    key: 'patel',
    name: 'R. Patel',
    exam: 'JEE',
  },
  {
    key: 'nair',
    name: 'K. Nair',
    exam: 'KCET',
  },
];

// Placeholder pricing — replace with real plans/currency before launch.
const pricingPlans = [
  {
    key: 'free',
    priceValue: 0,
    featureCount: 3,
    highlighted: false,
  },
  {
    key: 'pro',
    priceValue: 499,
    featureCount: 4,
    highlighted: true,
  },
  {
    key: 'premium',
    priceValue: 999,
    featureCount: 3,
    highlighted: false,
  },
];

const faqs = [
  {
    key: 'exams',
  },
  {
    key: 'engine',
  },
  {
    key: 'free',
  },
  {
    key: 'cancel',
  },
];

const HomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const heroAccuracyValue = useCountUp(18, { duration: 1500 });
  const heroReadinessValue = useCountUp(78, { duration: 1700 });
  const heroCtaRef = useMagneticHover();
  const finalCtaRef = useMagneticHover();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const faqItems = faqs.map((item) => ({
    question: t(`home.faq.${item.key}.q`),
    answer: t(`home.faq.${item.key}.a`),
  }));

  const goToLogin = () => navigate('/login');
  const goToRegister = () => navigate('/register');

  // Pricing buttons: choosing a plan is navigation only. Logged-out visitors go to register with the
  // plan preserved (?plan=PRO); signed-in users are routed by their *actual* tier. Nothing here
  // changes a tier - the server decides entitlements (see utils/planSelection.js).
  const { user, loading: authLoading } = useAuth();
  const { tier: liveTier } = useTier();
  const pricingUser = user ? { ...user, tier: liveTier || user.tier } : null;

  const scrollToSection = (id) => {
    setMobileNavOpen(false);
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
    setMobileNavOpen(false);
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

  // Mobile nav: Escape closes it, and it locks body scroll while open so
  // the page behind the dropdown panel can't be dragged around.
  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  // Close the mobile menu automatically if the viewport grows back past
  // the collapse breakpoint (e.g. rotating a tablet to landscape).
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 980) setMobileNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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

  return (
    <div className="landing-page">
      <div className="landing-noise" aria-hidden="true" />
      <header className={`landing-topbar ${isNavScrolled ? 'is-scrolled' : ''}`}>
        <BrandLogo className="landing-logo" to="/" onClick={scrollToTop} />

        <nav className="landing-nav">
          {navLinks.map((link) =>
            link.to ? (
              <Link key={link.to} to={link.to}>
                {t(link.labelKey)}
              </Link>
            ) : (
              <a
                key={link.href}
                href={`#${link.href}`}
                className={activeSection === link.href ? 'is-active' : ''}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToSection(link.href);
                }}
              >
                {t(link.labelKey)}
              </a>
            )
          )}
        </nav>

        <div className="landing-actions">
          <LanguageSelector variant="compact" />
          <button className="outline-btn" type="button" onClick={() => goToLogin()}>
            {t('auth.login')}
          </button>
          <button className="solid-btn" type="button" onClick={() => goToRegister()}>
            {t('home.startFreeTrial')}
          </button>
        </div>

        <button
          type="button"
          className={`landing-menu-btn ${mobileNavOpen ? 'is-open' : ''}`}
          aria-label={mobileNavOpen ? t('home.closeMenu') : t('home.openMenu')}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      {mobileNavOpen && (
        <div
          className="landing-mobile-backdrop"
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div
        className={`landing-mobile-menu ${mobileNavOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('home.siteNavigation')}
      >
        <nav className="landing-mobile-nav">
          {navLinks.map((link) =>
            link.to ? (
              <Link key={link.to} to={link.to} onClick={() => setMobileNavOpen(false)}>
                {t(link.labelKey)}
              </Link>
            ) : (
              <a
                key={link.href}
                href={`#${link.href}`}
                className={activeSection === link.href ? 'is-active' : ''}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToSection(link.href);
                }}
              >
                {t(link.labelKey)}
              </a>
            )
          )}
        </nav>
        <div className="landing-mobile-actions">
          <LanguageSelector variant="field" align="left" />
          <button
            className="outline-btn"
            type="button"
            onClick={() => {
              setMobileNavOpen(false);
              goToLogin();
            }}
          >
            {t('auth.login')}
          </button>
          <button
            className="solid-btn"
            type="button"
            onClick={() => {
              setMobileNavOpen(false);
              goToRegister();
            }}
          >
            {t('home.startFreeTrial')}
          </button>
        </div>
      </div>

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
          <span className="hero-badge">{t('home.hero.badge')}</span>
          <h1>{t('home.hero.title')}</h1>
          <p>{t('home.hero.text')}</p>

          <div className="hero-cta-row">
            <button
              ref={heroCtaRef}
              className="solid-btn magnetic-btn btn-with-arrow"
              type="button"
              onClick={() => goToRegister()}
            >
              {t('profile.startPracticing')}
              <ArrowRightIcon className="btn-arrow" />
            </button>
            <button className="outline-btn" type="button" onClick={() => scrollToSection('how-it-works')}>
              {t('home.hero.seeHow')}
            </button>
          </div>

          <ul className="hero-trust-row">
            {trustIndicators.map((item) => (
              <li key={item.key}>
                <item.Icon className="hero-trust-icon" aria-hidden="true" />
                {t(`home.trust.${item.key}`)}
              </li>
            ))}
          </ul>

          <div className="hero-3d-stage" aria-hidden="true">
            <AiNetworkHero />
          </div>
        </div>

        <div className="hero-float-card hero-float-card-1" aria-hidden="true">
          <span className="hero-float-label">{t('home.hero.weakTopicFound')}</span>
          <span className="hero-float-value">{t('home.hero.sampleTopic')}</span>
        </div>
        <div className="hero-float-card hero-float-card-2" aria-hidden="true">
          <span className="hero-float-label">{t('home.hero.accuracyThisWeek')}</span>
          <span className="hero-float-value hero-float-value-up">+{heroAccuracyValue}%</span>
        </div>
        <div className="hero-float-card hero-float-card-3" aria-hidden="true">
          <span className="hero-float-label">{t('dashboard.examReadiness')}</span>
          <span className="hero-float-value">{heroReadinessValue} / 100</span>
        </div>
        <RecommendationCard />
      </section>

      <section className="landing-section" id="why-tutormind">
        <Reveal as="h2">{t('home.nav.why')}</Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={60}>
          {t('home.why.subtext')}
        </Reveal>
        <div className="pillar-grid">
          {pillars.map((pillar, index) => (
            <Reveal as="article" className="pillar-card" key={pillar.key} delay={index * 90}>
              <span className="pillar-icon" aria-hidden="true">
                <pillar.Icon />
              </span>
              <h3>{t(`home.pillars.${pillar.key}.title`)}</h3>
              <p>{t(`home.pillars.${pillar.key}.copy`)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-split" id="ai-personalization">
        <Reveal as="div" className="split-copy">
          <span className="section-eyebrow">{t('home.personal.eyebrow')}</span>
          <h2>{t('home.personal.title')}</h2>
          <p className="landing-section-subtext left">{t('home.personal.text')}</p>
          <ul className="split-list">
            <li>{t('home.personal.b1')}</li>
            <li>{t('home.personal.b2')}</li>
            <li>{t('home.personal.b3')}</li>
          </ul>
        </Reveal>
        <Reveal as="div" delay={120} className="split-visual">
          <DashboardPreview />
        </Reveal>
      </section>

      <section className="landing-section" id="subjects-section">
        <Reveal as="h2">{t('home.subjects.title')}</Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={60}>
          {t('home.subjects.subtext')}
        </Reveal>
        <div className="subject-grid">
          {subjects.map((subject, index) => (
            <Reveal as="article" className="subject-card" key={subject.exam} delay={index * 90}>
              <h3>{subject.exam}</h3>
              <span className="subject-focus">{t(`home.subjects.${subject.key}.focus`)}</span>
              <p>{t(`home.subjects.${subject.key}.detail`)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <Reveal as="h2">{t('home.how.title')}</Reveal>
        <div className="steps-timeline">
          {steps.map((item, index) => (
            <Reveal as="article" className="step-card" key={item.step} delay={index * 100}>
              <span>{item.step}</span>
              <h3>{t(`home.how.${item.key}.title`)}</h3>
              <p>{t(`home.how.${item.key}.copy`)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="testimonials-section">
        <Reveal as="h2">{t('home.testimonials.title')}</Reveal>
        <div className="testimonial-grid">
          {testimonials.map((item, index) => (
            <Reveal as="figure" className="testimonial-card" key={item.name} delay={index * 90}>
              <div className="testimonial-stars" aria-label={t('home.testimonials.stars')}>
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <StarIcon key={starIndex} />
                ))}
              </div>
              <blockquote>{t('home.testimonials.quote', { quote: t(`home.testimonials.${item.key}`) })}</blockquote>
              <figcaption>
                <span className="testimonial-avatar" aria-hidden="true">
                  {item.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </span>
                <span className="testimonial-meta">
                  <strong>{item.name}</strong>
                  <span>{t('home.testimonials.role', { exam: item.exam })}</span>
                </span>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="pricing-section">
        <Reveal as="h2">{t('home.pricing.title')}</Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={60}>
          {t('home.pricing.subtext')}
        </Reveal>
        <div className="pricing-grid">
          {pricingPlans.map((plan, index) => {
            const action = resolvePricingAction({ plan: plan.key, user: pricingUser });
            return (
              <Reveal
                as="article"
                className={`pricing-card ${plan.highlighted ? 'pricing-card-highlight' : ''}`}
                key={plan.key}
                delay={index * 90}
              >
                {plan.highlighted && <span className="pricing-badge">{t('home.pricing.mostPopular')}</span>}
                {action.isCurrent && <span className="pricing-current-tag">{t('home.pricing.yourPlan')}</span>}
                <h3>{t(`home.pricing.${plan.key}.name`)}</h3>
                <p className="pricing-price">
                  <PriceCounter value={plan.priceValue} />
                  <span>{t(`home.pricing.${plan.key}.period`)}</span>
                </p>
                <p className="pricing-tagline">{t(`home.pricing.${plan.key}.tagline`)}</p>
                <ul className="pricing-features">
                  {Array.from({ length: plan.featureCount }).map((_, featureIndex) => (
                    <li key={featureIndex}>{t(`home.pricing.${plan.key}.f${featureIndex + 1}`)}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={plan.highlighted ? 'solid-btn' : 'outline-btn'}
                  disabled={authLoading || action.disabled}
                  data-plan={plan.key.toUpperCase()}
                  onClick={() => navigate(action.to)}
                >
                  {t(action.labelKey || `home.pricing.${plan.key}.cta`)}
                </button>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="landing-section" id="faq-section">
        <Reveal as="h2">{t('home.faq.title')}</Reveal>
        <Reveal as="div" delay={80} className="faq-wrap">
          <FaqAccordion items={faqItems} />
        </Reveal>
      </section>

      <Reveal as="section" className="landing-section cta-strip">
        <div className="cta-strip-glow" aria-hidden="true" />
        <h2>{t('home.cta.title')}</h2>
        <p className="landing-section-subtext">{t('home.cta.text')}</p>
        <button
          ref={finalCtaRef}
          className="solid-btn magnetic-btn cta-pulse-btn btn-with-arrow"
          type="button"
          onClick={() => goToRegister()}
        >
          {t('home.cta.button')}
          <ArrowRightIcon className="btn-arrow" />
        </button>
      </Reveal>

      <div className="landing-footer-wrap">
        <Footer />
      </div>
    </div>
  );
};

export default HomePage;