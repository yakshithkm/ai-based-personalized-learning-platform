import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import PersonalizedPlanPanel from '../components/learning/PersonalizedPlanPanel';
import { subjectColor, subjectIconPath } from '../utils/subjectVisuals';
import { translateServerError } from '../i18n/serverErrors';
import { subjectLabel } from '../i18n/labels';
import { useLocaleFormat } from '../i18n/format';

const priorityForAccuracy = (accuracy = 0) => {
  if (accuracy < 50) return 'High';
  if (accuracy < 70) return 'Medium';
  return 'Low';
};

const priorityClass = (priority) => {
  if (priority === 'High') return 'priority-high';
  if (priority === 'Medium') return 'priority-medium';
  return 'priority-low';
};

const SubjectIcon = ({ subject }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={subjectIconPath(subject)} />
  </svg>
);

const StudyPlanPage = () => {
  const { t } = useTranslation();
  const { formatPercent } = useLocaleFormat();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const [aRes, rRes] = await Promise.all([
        api.get('/analytics/me'),
        api.get('/recommendations/me'),
      ]);
      setAnalytics(aRes.data);
      setRecommendations(rRes.data);
    } catch (err) {
      setError(translateServerError(t, err?.response?.data?.message, 'studyPlan.loadFailed'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const weakTopics = analytics?.weakTopicPriority || [];
  const studyStrategy = analytics?.studentInsightLayer?.studyStrategy || { timeAllocation: [], dailyStudyPlan: [], guidanceText: '' };

  const recommendedTopicCounts = useMemo(() => {
    const counts = new Map();
    (recommendations?.recommendations || []).forEach((q) => {
      const key = `${q.subject} - ${q.topic}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [recommendations]);

  const planItems = useMemo(() => weakTopics.map((entry) => {
    const key = `${entry.subject} - ${entry.topic}`;
    return {
      ...entry,
      key,
      priority: priorityForAccuracy(Number(entry.accuracy || 0)),
      questionCount: recommendedTopicCounts.get(key) || Math.max(Math.round((100 - Number(entry.accuracy || 0)) / 7), 5),
    };
  }), [weakTopics, recommendedTopicCounts]);

  const goPractice = (subject, topic) => {
    navigate(`/practice?topic=${encodeURIComponent(`${subject} - ${topic}`)}`);
  };

  if (!analytics && !error) {
    return (
      <div className="page-grid">
        <section className="panel" aria-busy="true" aria-label={t('studyPlan.loading')}>
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
          <h3>{t('studyPlan.couldntLoad')}</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>{t('common.tryAgain')}</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>{t('dashboard.aiStudyPlan')}</h2>
        <p>{studyStrategy.guidanceText || t('dashboard.aiStudyPlanSubtitle')}</p>
      </section>

      <PersonalizedPlanPanel />

      {studyStrategy.timeAllocation?.length > 0 && (
        <section className="panel">
          <h3>{t('studyPlan.timeAllocation')}</h3>
          <div className="time-allocation-list">
            {studyStrategy.timeAllocation.map((entry) => (
              <div key={entry.subject} className="time-allocation-row">
                <span className="subject-dot" style={{ background: subjectColor(entry.subject) }} />
                <span className="time-allocation-subject">{subjectLabel(t, entry.subject)}</span>
                <span className="subject-bar-track">
                  <span className="subject-bar-fill" style={{ width: `${entry.percent}%`, background: subjectColor(entry.subject) }} />
                </span>
                <span className="time-allocation-pct">{formatPercent(entry.percent)}</span>
                <small className="time-allocation-reason">{entry.reason}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {studyStrategy.dailyStudyPlan?.length > 0 && (
        <section className="panel">
          <h3>{t('studyPlan.todaysSessions')}</h3>
          <div className="session-list">
            {studyStrategy.dailyStudyPlan.map((session) => (
              <article key={session.slot} className="session-row">
                <strong>{session.slot}</strong>
                <p>{session.task}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h3>{t('studyPlan.priorityTopics')}</h3>
        {planItems.length ? (
          <div className="study-plan-list">
            {planItems.map((item) => (
              <button type="button" key={item.key} className="study-plan-row" onClick={() => goPractice(item.subject, item.topic)}>
                <span className="study-plan-icon" style={{ color: subjectColor(item.subject), background: `${subjectColor(item.subject)}22` }}>
                  <SubjectIcon subject={item.subject} />
                </span>
                <span className="study-plan-info">
                  <strong>{item.topic}</strong>
                  <small>{subjectLabel(t, item.subject)} • {t('common.questionCount', { count: item.questionCount })}</small>
                </span>
                <span className={`priority-badge ${priorityClass(item.priority)}`}>{t(`priority.${item.priority.toLowerCase()}`)}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="practice"
            title={t('studyPlan.emptyTitle')}
            description={t('studyPlan.emptyText')}
            actionLabel={t('common.goToPractice')}
            onAction={() => navigate('/practice')}
          />
        )}
      </section>

      {error && <section className="panel error-text">{error}</section>}
    </div>
  );
};

export default StudyPlanPage;