import { useEffect, useState } from 'react';
import api from '../../api/client';

const AdminAnalyticsSectionPage = () => {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: res } = await api.get('/admin/analytics', { params: { days } });
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h2>Platform Analytics</h2>
          <p>Insights computed from real attempt and exam data.</p>
        </div>
        <select className="admin-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </header>

      {error && <div className="admin-page-error">{error}</div>}
      {loading && <div className="admin-page-loading">Loading analytics...</div>}

      {!loading && data && (
        <>
          <section className="admin-two-col">
            <div className="panel admin-panel">
              <h3>Subject Performance</h3>
              {data.subjectPerformance.length ? (
                <ul className="admin-simple-list">
                  {data.subjectPerformance.map((s) => (
                    <li key={s.subject}>
                      <span>{s.subject}</span>
                      <span className="admin-muted">{s.accuracy}% · {s.attempts} attempts</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-empty-text">No attempts in this window.</p>
              )}
            </div>

            <div className="panel admin-panel">
              <h3>Most Difficult Topics</h3>
              {data.mostDifficultTopics.length ? (
                <ul className="admin-simple-list">
                  {data.mostDifficultTopics.map((t) => (
                    <li key={`${t.subject}-${t.topic}`}>
                      <span>{t.subject} · {t.topic}</span>
                      <span className="admin-badge-pill admin-badge-danger">{t.accuracy}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-empty-text">Not enough attempts to determine difficulty yet.</p>
              )}
            </div>
          </section>

          <section className="admin-two-col">
            <div className="panel admin-panel">
              <h3>Most Common Weak Topics</h3>
              {data.mostCommonWeakTopics.length ? (
                <ul className="admin-simple-list">
                  {data.mostCommonWeakTopics.map((t) => (
                    <li key={`${t.subject}-${t.topic}`}>
                      <span>{t.subject} · {t.topic}</span>
                      <span className="admin-muted">{t.mistakeCount} mistakes</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-empty-text">No mistakes logged in this window.</p>
              )}
            </div>

            <div className="panel admin-panel">
              <h3>Exam Activity</h3>
              <ul className="admin-simple-list">
                <li><span>Active sessions</span><span className="admin-muted">{data.examActivity.active || 0}</span></li>
                <li><span>Submitted</span><span className="admin-muted">{data.examActivity.submitted || 0}</span></li>
                <li><span>Expired</span><span className="admin-muted">{data.examActivity.expired || 0}</span></li>
              </ul>
            </div>
          </section>

          <div className="panel admin-panel">
            <h3>Daily Practice Activity</h3>
            {data.dailyActivity.length ? (
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Attempts</th>
                      <th>Active Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dailyActivity.map((d) => (
                      <tr key={d.day}>
                        <td>{d.day}</td>
                        <td>{d.attempts}</td>
                        <td>{d.activeUsers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-empty-text">No activity in this window.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAnalyticsSectionPage;