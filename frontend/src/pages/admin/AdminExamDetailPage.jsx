import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';

const AdminExamDetailPage = () => {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/admin/exams/${id}`);
        if (!cancelled) setSession(data.session);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load exam session');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <div className="admin-page-loading">Loading exam session...</div>;
  if (error) return <div className="admin-page-error">{error}</div>;
  if (!session) return null;

  const scoreSummary = session.resultSummary?.scoreSummary;
  const postTest = session.resultSummary?.postTestAnalysis;

  return (
    <div className="admin-page">
      <Link to="/admin/exams" className="admin-back-link">
        ← Back to Exams
      </Link>

      <header className="admin-page-header">
        <div>
          <h2>{session.user?.name}'s {session.examType} {session.mode} Exam</h2>
          <p>{session.user?.email}</p>
        </div>
      </header>

      <section className="admin-stats-grid">
        <article className="metric-card metric-neutral admin-stat-card">
          <h4>Status</h4>
          <strong>{session.status}</strong>
        </article>
        <article className="metric-card metric-neutral admin-stat-card">
          <h4>Questions</h4>
          <strong>{session.questionCount}</strong>
        </article>
        <article className="metric-card metric-neutral admin-stat-card">
          <h4>Score</h4>
          <strong>
            {scoreSummary ? `${scoreSummary.totalScore}/${scoreSummary.maxScore}` : '—'}
          </strong>
        </article>
        <article className="metric-card metric-neutral admin-stat-card">
          <h4>Integrity Flag</h4>
          <strong>{session.integrityRisk ? 'Flagged' : 'Clean'}</strong>
        </article>
      </section>

      {postTest && (
        <section className="admin-two-col">
          <div className="panel admin-panel">
            <h3>Strong Subjects</h3>
            {postTest.strongSubjects?.length ? (
              <ul className="admin-simple-list">
                {postTest.strongSubjects.map((s, i) => (
                  <li key={i}><span>{typeof s === 'string' ? s : s.subject}</span></li>
                ))}
              </ul>
            ) : (
              <p className="admin-empty-text">No standout subjects.</p>
            )}
          </div>
          <div className="panel admin-panel">
            <h3>Weak Subjects</h3>
            {postTest.weakSubjects?.length ? (
              <ul className="admin-simple-list">
                {postTest.weakSubjects.map((s, i) => (
                  <li key={i}><span>{typeof s === 'string' ? s : s.subject}</span></li>
                ))}
              </ul>
            ) : (
              <p className="admin-empty-text">No weak subjects flagged.</p>
            )}
          </div>
        </section>
      )}

      <div className="panel admin-panel">
        <h3>Timing</h3>
        <ul className="admin-simple-list">
          <li><span>Started</span><span className="admin-muted">{session.startedAt ? new Date(session.startedAt).toLocaleString() : '—'}</span></li>
          <li><span>Submitted</span><span className="admin-muted">{session.submittedAt ? new Date(session.submittedAt).toLocaleString() : '—'}</span></li>
          <li><span>Time Limit</span><span className="admin-muted">{Math.round((session.timeLimitSec || 0) / 60)} minutes</span></li>
        </ul>
      </div>
    </div>
  );
};

export default AdminExamDetailPage;