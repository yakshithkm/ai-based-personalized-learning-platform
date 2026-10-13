import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import { subjectColor } from '../utils/subjectVisuals';
import { formatRelativeTime } from '../utils/achievements';
import { translateServerError } from '../i18n/serverErrors';
import { mistakeTypeLabel, subjectLabel } from '../i18n/labels';
import { useTheme } from '../context/ThemeContext';

const MistakeBankPage = () => {
  useTheme(); // re-render on theme switch so theme-dependent chart/subject colours update
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/analytics/me');
      setAnalytics(data);
    } catch (err) {
      setError(translateServerError(t, err?.response?.data?.message, 'mistakeBank.loadFailed'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mistakeBank = analytics?.mistakeBank || {};
  const recentMistakes = mistakeBank.recentMistakes || [];
  const repeatedMistakes = mistakeBank.repeatedMistakes || [];

  const goPractice = (subject, topic) => {
    navigate(`/practice?topic=${encodeURIComponent(`${subject} - ${topic}`)}`);
  };

  if (!analytics && !error) {
    return (
      <div className="page-grid">
        <section className="panel" aria-busy="true" aria-label={t('mistakeBank.loading')}>
          <div className="skeleton-chip" style={{ width: '200px', marginBottom: '0.7rem' }} />
          <div className="skeleton-block" style={{ minHeight: '260px' }} />
        </section>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="page-grid">
        <section className="panel error-state-card">
          <h3>{t('mistakeBank.couldntLoad')}</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>{t('common.tryAgain')}</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>{t('navigation.mistakeBank')}</h2>
        <p>{t('mistakeBank.intro')}</p>
      </section>

      {repeatedMistakes.length > 0 && (
        <section className="panel">
          <h3>{t('mistakeBank.repeatedPatterns')}</h3>
          <p className="dash-card-subtitle">{t('mistakeBank.repeatedSubtitle')}</p>
          <div className="repeated-mistake-list">
            {repeatedMistakes.map((entry, index) => (
              <button
                type="button"
                key={`${entry.subject}-${entry.topic}-${index}`}
                className="repeated-mistake-row"
                onClick={() => goPractice(entry.subject, entry.topic)}
              >
                <span className="subject-dot" style={{ background: subjectColor(entry.subject) }} />
                <span className="repeated-mistake-info">
                  <strong>{entry.topic}</strong>
                  <small>{subjectLabel(t, entry.subject)}</small>
                </span>
                <span className="severity-badge severity-critical">{t('mistakeBank.timesMissed', { count: entry.failures })}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h3>{t('mistakeBank.recentMistakes')}</h3>
        {recentMistakes.length ? (
          <div className="mistake-list">
            {recentMistakes.map((mistake) => (
              <article key={mistake._id || `${mistake.subject}-${mistake.topic}-${mistake.createdAt}`} className="mistake-row">
                <span className="subject-dot" style={{ background: subjectColor(mistake.subject) }} />
                <div className="mistake-info">
                  <strong>{mistake.topic}</strong>
                  <small>
                    {subjectLabel(t, mistake.subject)}
                    {mistake.subtopic && mistake.subtopic !== 'General' ? ` • ${mistake.subtopic}` : ''}
                    {mistake.mistakeType ? ` • ${mistakeTypeLabel(t, mistake.mistakeType)}` : ''}
                  </small>
                </div>
                <span className={`severity-badge ${mistake.resolved ? 'severity-moderate' : 'severity-weak'}`}>
                  {mistake.resolved ? t('mistakeBank.resolved') : t('mistakeBank.pendingReview')}
                </span>
                <span className="mistake-time">{formatRelativeTime(mistake.createdAt, t)}</span>
                <button type="button" className="outline-btn dash-small-btn" onClick={() => goPractice(mistake.subject, mistake.topic)}>
                  {t('common.retry')}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="practice"
            title={t('mistakeBank.emptyTitle')}
            description={t('mistakeBank.emptyText')}
            actionLabel={t('common.goToPractice')}
            onAction={() => navigate('/practice')}
          />
        )}
      </section>

      {error && <section className="panel error-text">{error}</section>}
    </div>
  );
};

export default MistakeBankPage;