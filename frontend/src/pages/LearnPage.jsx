import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getLearningBundle } from '../api/learning';
import EmptyState from '../components/EmptyState';
import LearnNextCard from '../components/learning/LearnNextCard';
import RecommendationCard from '../components/learning/RecommendationCard';
import DailyPlan from '../components/learning/DailyPlan';
import ImprovementBanner from '../components/learning/ImprovementBanner';

const SECTION_ORDER = [
  ['weakAreas', 'Review Your Weak Areas', 'Study material for concepts below your target accuracy.', 'Review'],
  ['mistakeRecovery', 'Fix Your Mistakes', 'The ideas behind mistakes you repeat or are due to review.', 'Fix it'],
  ['continueLearning', 'Continue Learning', 'Pick up what you started.', 'Continue'],
  ['practiceAfterLearning', 'Practice After Learning', 'Test what you recently completed.', 'Start practice'],
  ['challenges', 'Challenge Yourself', 'Advanced material for topics you have mastered.', 'Take the challenge'],
  ['exploreNew', 'Explore New Topics', 'Syllabus areas you have not touched yet.', 'Explore'],
];

const LearnSkeleton = () => (
  <div className="page-grid">
    <section className="panel" aria-busy="true" aria-label="Loading your learning recommendations">
      <div className="skeleton-chip" style={{ width: '160px', marginBottom: '0.8rem' }} />
      <div className="skeleton-block" style={{ minHeight: '280px' }} />
    </section>
    <section className="panel">
      <div className="skeleton-block" style={{ minHeight: '140px' }} />
    </section>
  </div>
);

const RecommendationSection = ({ title, description, items, ctaLabel }) => {
  if (!items?.length) return null;
  return (
    <section className="panel lr-section" aria-label={title}>
      <div className="panel-head-row">
        <h3>{title}</h3>
        <span className="subtle-label">{description}</span>
      </div>
      <div className="lr-card-grid">
        {items.map((item) => (
          <RecommendationCard key={item.id} item={item} ctaLabel={ctaLabel} />
        ))}
      </div>
    </section>
  );
};

const LearnPage = () => {
  const navigate = useNavigate();
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      setBundle(await getLearningBundle());
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load your learning recommendations');
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!bundle && !error) return <LearnSkeleton />;

  if (error && !bundle) {
    return (
      <div className="page-grid">
        <section className="panel error-state-card">
          <h3>Couldn&apos;t load your recommendations</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>Try again</button>
        </section>
      </div>
    );
  }

  const primary = bundle.learnNext?.primary || null;
  const alsoConsider = bundle.learnNext?.alsoConsider || [];
  const sections = bundle.sections || {};
  const hasAnything = Boolean(primary) || SECTION_ORDER.some(([key]) => sections[key]?.length);
  const improvements = bundle.improvements || [];

  if (!hasAnything && bundle.mode !== 'cold-start') {
    return (
      <div className="page-grid">
        <EmptyState
          icon="practice"
          title={bundle.emptyState?.title || 'Nothing to recommend yet'}
          description={bundle.emptyState?.message || 'Practice a few questions and personalized learning material will appear here.'}
          actionLabel="Start practicing"
          onAction={() => navigate('/practice?mode=recommended')}
        />
      </div>
    );
  }

  return (
    <div className="page-grid lr-page">
      {bundle.mode === 'cold-start' && (
        <section className="panel lr-welcome">
          <p className="eyebrow-label">{bundle.welcome?.title || 'Welcome to TutorMind'}</p>
          <h2>{bundle.welcome?.message || "Let's establish your learning baseline."}</h2>
          <p>Answer a short starter set so recommendations can adapt to how you actually perform. Until then, here is a balanced place to begin.</p>
          {bundle.startingPath?.length > 0 && (
            <ul className="lr-start-path" aria-label="Recommended starting path">
              {bundle.startingPath.map((step) => (
                <li key={`${step.subject}-${step.topic}`}>
                  <strong>{step.subject}</strong> → {step.topic}
                  {!step.hasStudyMaterial && <small> · practice first</small>}
                </li>
              ))}
            </ul>
          )}
          <Link className="solid-btn" to={bundle.welcome?.baselineRoute || '/practice?mode=recommended'}>Start baseline practice</Link>
        </section>
      )}

      {bundle.mode === 'baseline' && bundle.baseline && (
        <section className="panel lr-baseline-note" role="status">
          <p>
            Based on {bundle.baseline.attempts} answered question{bundle.baseline.attempts === 1 ? '' : 's'} so far.
            Answer {Math.max(bundle.baseline.needed - bundle.baseline.attempts, 0)} more to unlock sharper recommendations.
          </p>
        </section>
      )}

      {primary && <LearnNextCard item={primary} />}

      <DailyPlan plan={bundle.dailyPlan} />

      {improvements.slice(0, 2).map((entry) => (
        <ImprovementBanner key={entry.recommendationId} title={entry.title} effectiveness={entry.effectiveness} />
      ))}

      {alsoConsider.length > 0 && (
        <RecommendationSection title="Also worth your time" description="Different topics, next in line." items={alsoConsider} />
      )}

      {SECTION_ORDER.map(([key, title, description, cta]) => (
        <RecommendationSection key={key} title={title} description={description} items={sections[key]} ctaLabel={cta} />
      ))}
    </div>
  );
};

export default LearnPage;