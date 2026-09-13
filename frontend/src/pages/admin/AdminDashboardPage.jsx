import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const StatCard = ({ label, value, sub }) => (
  <article className="metric-card metric-neutral admin-stat-card">
    <h4>{label}</h4>
    <strong>{value}</strong>
    {sub && <p>{sub}</p>}
  </article>
);

const AdminDashboardPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: res } = await api.get('/admin/dashboard');
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="admin-page-loading">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="admin-page-error">
        <p>{error}</p>
      </div>
    );
  }

  const totals = data?.totals || {};
  const averages = data?.averages || {};

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h2>Admin Dashboard</h2>
          <p>Platform-wide overview of students, content, and activity.</p>
        </div>
      </header>

      <section className="admin-stats-grid">
        <StatCard label="Total Students" value={totals.students ?? 0} />
        <StatCard label="Active Students" value={totals.activeStudents ?? 0} sub="Practiced in last 7 days" />
        <StatCard label="Total Subjects" value={totals.subjects ?? 0} />
        <StatCard label="Total Topics" value={totals.topics ?? 0} />
        <StatCard label="Total Questions" value={totals.questions ?? 0} />
        <StatCard label="Total Exam Sessions" value={totals.examSessions ?? 0} />
        <StatCard label="Average Accuracy" value={`${averages.accuracy ?? 0}%`} sub={`${averages.studentsWithData ?? 0} students with data`} />
        <StatCard label="Average Readiness" value={`${averages.readiness ?? 0}%`} />
      </section>

      <section className="admin-two-col">
        <div className="panel admin-panel">
          <div className="admin-panel-head">
            <h3>Recent Student Activity</h3>
            <Link to="/admin/students" className="admin-link-btn">
              View all students
            </Link>
          </div>
          {data?.recentActivity?.length ? (
            <ul className="admin-activity-list">
              {data.recentActivity.map((item, idx) => (
                <li key={idx} className="admin-activity-item">
                  <div>
                    <strong>{item.studentName}</strong>
                    <span className="admin-muted"> answered a {item.subject} / {item.topic} question</span>
                  </div>
                  <span className={`admin-badge-pill ${item.isCorrect ? 'admin-badge-success' : 'admin-badge-danger'}`}>
                    {item.isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty-text">No recent activity yet.</p>
          )}
        </div>

        <div className="panel admin-panel">
          <div className="admin-panel-head">
            <h3>Recent Exams / Attempts</h3>
            <Link to="/admin/exams" className="admin-link-btn">
              View all exams
            </Link>
          </div>
          {data?.recentExams?.length ? (
            <ul className="admin-activity-list">
              {data.recentExams.map((exam) => (
                <li key={exam.sessionId} className="admin-activity-item">
                  <div>
                    <strong>{exam.studentName}</strong>
                    <span className="admin-muted">
                      {' '}
                      · {exam.examType} {exam.mode} · {exam.status}
                    </span>
                  </div>
                  <span className="admin-muted">
                    {exam.score != null ? `${exam.score}/${exam.maxScore}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty-text">No exam sessions yet.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminDashboardPage;