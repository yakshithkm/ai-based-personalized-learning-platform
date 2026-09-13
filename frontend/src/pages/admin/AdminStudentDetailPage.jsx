import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';

const AdminStudentDetailPage = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: res } = await api.get(`/admin/students/${id}`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load student');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <div className="admin-page-loading">Loading student...</div>;
  if (error) return <div className="admin-page-error">{error}</div>;
  if (!data) return null;

  const { student, analytics, recentAttempts } = data;
  const performance = analytics?.performance || {};
  const subjectStats = performance.subjectStats || [];
  const weakTopics = analytics?.weakTopicPriority || [];
  const topicMastery = (analytics?.topicMastery || [])
    .slice()
    .sort((a, b) => b.accuracy - a.accuracy);
  const strongTopics = topicMastery.filter((t) => t.attempts >= 3 && t.accuracy >= 75).slice(0, 6);

  return (
    <div className="admin-page">
      <Link to="/admin/students" className="admin-back-link">
        ← Back to Students
      </Link>

      <header className="admin-page-header">
        <div>
          <h2>{student.name}</h2>
          <p>
            {student.email} · Target: {student.targetExam} · Joined{' '}
            {new Date(student.registeredAt).toLocaleDateString()}
          </p>
        </div>
      </header>

      <section className="admin-stats-grid">
        <article className="metric-card metric-neutral admin-stat-card">
          <h4>Overall Accuracy</h4>
          <strong>{Math.round(performance.overallAccuracy || 0)}%</strong>
        </article>
        <article className="metric-card metric-neutral admin-stat-card">
          <h4>Readiness</h4>
          <strong>{Math.round(analytics?.examReadiness?.score || 0)}%</strong>
        </article>
        <article className="metric-card metric-neutral admin-stat-card">
          <h4>Current Streak</h4>
          <strong>{performance.currentStreak || 0} days</strong>
        </article>
        <article className="metric-card metric-neutral admin-stat-card">
          <h4>Total Attempts</h4>
          <strong>{performance.totalAttempts || 0}</strong>
        </article>
      </section>

      <section className="admin-two-col">
        <div className="panel admin-panel">
          <h3>Subject-wise Performance</h3>
          {subjectStats.length ? (
            <ul className="admin-simple-list">
              {subjectStats.map((s) => (
                <li key={s.subject}>
                  <span>{s.subject}</span>
                  <span className="admin-muted">
                    {Math.round(s.accuracy)}% · {s.attempts} attempts
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty-text">No practice data yet.</p>
          )}
        </div>

        <div className="panel admin-panel">
          <h3>Weak Topics</h3>
          {weakTopics.length ? (
            <ul className="admin-simple-list">
              {weakTopics.slice(0, 8).map((t) => (
                <li key={`${t.subject}-${t.topic}`}>
                  <span>
                    {t.subject} · {t.topic}
                  </span>
                  <span className="admin-badge-pill admin-badge-danger">{Math.round(t.accuracy)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty-text">No weak topics detected.</p>
          )}
        </div>
      </section>

      <section className="admin-two-col">
        <div className="panel admin-panel">
          <h3>Strong Topics</h3>
          {strongTopics.length ? (
            <ul className="admin-simple-list">
              {strongTopics.map((t) => (
                <li key={`${t.subject}-${t.topic}`}>
                  <span>
                    {t.subject} · {t.topic}
                  </span>
                  <span className="admin-badge-pill admin-badge-success">{Math.round(t.accuracy)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty-text">Not enough data yet to identify strong topics.</p>
          )}
        </div>

        <div className="panel admin-panel">
          <h3>Recent Attempts</h3>
          {recentAttempts?.length ? (
            <ul className="admin-simple-list">
              {recentAttempts.slice(0, 8).map((a) => (
                <li key={a._id}>
                  <span>
                    {a.subject} · {a.topic} ({a.difficulty})
                  </span>
                  <span className={`admin-badge-pill ${a.isCorrect ? 'admin-badge-success' : 'admin-badge-danger'}`}>
                    {a.isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty-text">No attempts yet.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminStudentDetailPage;