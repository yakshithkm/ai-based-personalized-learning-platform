import { useEffect, useState } from 'react';
import api from '../../api/client';

const AdminSubjectsPage = () => {
  const [subjects, setSubjects] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/admin/subjects');
        if (!cancelled) {
          setSubjects(data.subjects);
          setNote(data.note);
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load subjects');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h2>Subjects</h2>
          <p>Overview of the platform's four exam subjects.</p>
        </div>
      </header>

      <div className="admin-info-banner">
        {note ||
          'Subjects are a fixed set used across the exam engine, recommendation service, and ML pipeline. Add/edit/delete is not offered here to avoid breaking those systems.'}
      </div>

      {error && <div className="admin-page-error">{error}</div>}
      {loading ? (
        <div className="admin-page-loading">Loading subjects...</div>
      ) : (
        <section className="admin-stats-grid">
          {subjects.map((s) => (
            <article key={s.subject} className="metric-card metric-neutral admin-stat-card">
              <h4>{s.subject}</h4>
              <strong>{s.questionCount} questions</strong>
              <p>{s.topicCount} topics</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default AdminSubjectsPage;