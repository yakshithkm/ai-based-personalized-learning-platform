import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import { subjectColor } from '../utils/subjectVisuals';
import { translateServerError } from '../i18n/serverErrors';
import { subjectLabel } from '../i18n/labels';
import { useLocaleFormat } from '../i18n/format';
import { useTheme } from '../context/ThemeContext';

const severityLabel = (accuracy) => {
  if (accuracy < 40) return { labelKey: 'weakTopics.severity.critical', tone: 'critical' };
  if (accuracy < 60) return { labelKey: 'weakTopics.severity.weak', tone: 'weak' };
  return { labelKey: 'weakTopics.severity.needsPractice', tone: 'moderate' };
};

const WeakTopicsPage = () => {
  useTheme(); // re-render on theme switch so theme-dependent chart/subject colours update
  const { t } = useTranslation();
  const { formatPercent } = useLocaleFormat();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/analytics/me');
      setAnalytics(data);
    } catch (err) {
      setError(translateServerError(t, err?.response?.data?.message, 'weakTopics.loadFailed'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const weakTopics = analytics?.weakTopicPriority || [];

  const subjects = useMemo(() => {
    const set = new Set(weakTopics.map((entry) => entry.subject));
    return ['All', ...Array.from(set)];
  }, [weakTopics]);

  const filtered = useMemo(() => {
    if (subjectFilter === 'All') return weakTopics;
    return weakTopics.filter((entry) => entry.subject === subjectFilter);
  }, [weakTopics, subjectFilter]);

  const goPractice = (subject, topic) => {
    navigate(`/practice?topic=${encodeURIComponent(`${subject} - ${topic}`)}`);
  };

  if (!analytics && !error) {
    return (
      <div className="page-grid">
        <section className="panel" aria-busy="true" aria-label={t('weakTopics.loading')}>
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
          <h3>{t('weakTopics.couldntLoad')}</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>{t('common.tryAgain')}</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>{t('navigation.weakTopics')}</h2>
        <p>{t('weakTopics.intro')}</p>
      </section>

      {weakTopics.length === 0 ? (
        <EmptyState
          icon="analytics"
          title={t('weakTopics.emptyTitle')}
          description={t('weakTopics.emptyText')}
          actionLabel={t('common.goToPractice')}
          onAction={() => navigate('/practice')}
        />
      ) : (
        <>
          <section className="panel subject-filter-row">
            {subjects.map((subject) => (
              <button
                key={subject}
                type="button"
                className={`subject-filter-chip ${subjectFilter === subject ? 'active' : ''}`}
                style={subjectFilter === subject && subject !== 'All' ? { borderColor: subjectColor(subject), color: subjectColor(subject) } : undefined}
                onClick={() => setSubjectFilter(subject)}
              >
                {subject === 'All' ? t('common.all') : subjectLabel(t, subject)}
              </button>
            ))}
          </section>

          <section className="panel">
            <div className="weak-topics-table">
              {filtered.map((entry) => {
                const severity = severityLabel(Number(entry.accuracy || 0));
                return (
                  <article key={`${entry.subject}-${entry.topic}`} className="weak-topics-row-v2">
                    <span className="subject-dot" style={{ background: subjectColor(entry.subject) }} />
                    <div className="weak-topics-info">
                      <strong>{entry.topic}</strong>
                      <small>{subjectLabel(t, entry.subject)}{entry.subtopic && entry.subtopic !== 'General' ? ` • ${entry.subtopic}` : ''}</small>
                    </div>
                    <span className={`severity-badge severity-${severity.tone}`}>{t(severity.labelKey)}</span>
                    <div className="weak-topics-metric">
                      <span className="subject-bar-track weak-bar-track">
                        <span className="subject-bar-fill weak-bar-fill" style={{ width: `${Math.min(100, Number(entry.accuracy || 0))}%` }} />
                      </span>
                      <span>{t('weakTopics.accuracyValue', { value: formatPercent(Number(entry.accuracy || 0).toFixed(0)) })}</span>
                    </div>
                    <button type="button" className="solid-btn dash-small-btn" onClick={() => goPractice(entry.subject, entry.topic)}>
                      {t('navigation.practice')}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {error && <section className="panel error-text">{error}</section>}
    </div>
  );
};

export default WeakTopicsPage;