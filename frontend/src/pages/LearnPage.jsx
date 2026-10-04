import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { translateServerError } from '../i18n/serverErrors';
import { subjectLabel } from '../i18n/labels';
import { getLearningBundle } from '../api/learning';
import EmptyState from '../components/EmptyState';
import LearnNextCard from '../components/learning/LearnNextCard';
import RecommendationCard from '../components/learning/RecommendationCard';
import DailyPlan from '../components/learning/DailyPlan';
import ImprovementBanner from '../components/learning/ImprovementBanner';

const SECTION_ORDER = [
  ['weakAreas', 'weakAreas'],
  ['mistakeRecovery', 'mistakeRecovery'],
  ['continueLearning', 'continueLearning'],
  ['practiceAfterLearning', 'practiceAfterLearning'],
  ['challenges', 'challenges'],
  ['exploreNew', 'exploreNew'],
];

const LearnSkeleton = () => {
  const { t } = useTranslation();
  return (
  <div className="page-grid">
    <section className="panel" aria-busy="true" aria-label={t('learn.loading')}>
      <div className="skeleton-chip" style={{ width: '160px', marginBottom: '0.8rem' }} />
      <div className="skeleton-block" style={{ minHeight: '280px' }} />
    </section>
    <section className="panel">
      <div className="skeleton-block" style={{ minHeight: '140px' }} />
    </section>
  </div>
  );
};

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
  const { t, i18n } = useTranslation();
  // Server-authored copy (empty state / welcome) is English-only. Show it verbatim when the UI is
  // English (unchanged behaviour); in other languages use the localized equivalents instead.
  const isEnglish = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('en');
  const serverText = (value, key) => (isEnglish && value ? value : t(key));
  const navigate = useNavigate();
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      setBundle(await getLearningBundle());
    } catch (err) {
      setError(translateServerError(t, err?.response?.data?.message, 'learn.loadFailed'));
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
          <h3>{t('learn.couldntLoad')}</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>{t('common.tryAgain')}</button>
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
          title={serverText(bundle.emptyState?.title, 'learn.emptyTitle')}
          description={serverText(bundle.emptyState?.message, 'learn.emptyText')}
          actionLabel={t('profile.startPracticing')}
          onAction={() => navigate('/practice?mode=recommended')}
        />
      </div>
    );
  }

  return (
    <div className="page-grid lr-page">
      {bundle.mode === 'cold-start' && (
        <section className="panel lr-welcome">
          <p className="eyebrow-label">{serverText(bundle.welcome?.title, 'learn.welcomeTitle')}</p>
          <h2>{serverText(bundle.welcome?.message, 'learn.welcomeMessage')}</h2>
          <p>{t('learn.welcomeText')}</p>
          {bundle.startingPath?.length > 0 && (
            <ul className="lr-start-path" aria-label={t('learn.startingPathAria')}>
              {bundle.startingPath.map((step) => (
                <li key={`${step.subject}-${step.topic}`}>
                  <strong>{subjectLabel(t, step.subject)}</strong> → {step.topic}
                  {!step.hasStudyMaterial && <small> · {t('learn.practiceFirst')}</small>}
                </li>
              ))}
            </ul>
          )}
          <Link className="solid-btn" to={bundle.welcome?.baselineRoute || '/practice?mode=recommended'}>{t('learn.startBaseline')}</Link>
        </section>
      )}

      {bundle.mode === 'baseline' && bundle.baseline && (
        <section className="panel lr-baseline-note" role="status">
          <p>
            {t('learn.baselineNote', { answered: bundle.baseline.attempts, count: bundle.baseline.attempts, remaining: Math.max(bundle.baseline.needed - bundle.baseline.attempts, 0) })}
          </p>
        </section>
      )}

      {primary && <LearnNextCard item={primary} />}

      <DailyPlan plan={bundle.dailyPlan} />

      {improvements.slice(0, 2).map((entry) => (
        <ImprovementBanner key={entry.recommendationId} title={entry.title} effectiveness={entry.effectiveness} />
      ))}

      {alsoConsider.length > 0 && (
        <RecommendationSection title={t('learn.alsoWorth')} description={t('learn.alsoWorthSub')} items={alsoConsider} />
      )}

      {SECTION_ORDER.map(([key, i18nKey]) => (
        <RecommendationSection
          key={key}
          title={t(`learn.sections.${i18nKey}.title`)}
          description={t(`learn.sections.${i18nKey}.description`)}
          items={sections[key]}
          ctaLabel={t(`learn.sections.${i18nKey}.cta`)}
        />
      ))}
    </div>
  );
};

export default LearnPage;