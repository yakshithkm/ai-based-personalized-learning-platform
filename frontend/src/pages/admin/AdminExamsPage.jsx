import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import Pagination from '../../components/admin/Pagination';

const STATUSES = ['active', 'submitted', 'expired'];
const EXAM_TYPES = ['NEET', 'JEE', 'CET'];
const MODES = ['full-length', 'section-wise'];

const AdminExamsPage = () => {
  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [status, setStatus] = useState('');
  const [examType, setExamType] = useState('');
  const [mode, setMode] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/admin/exams', {
          params: { status, examType, mode, search, page, pageSize: 20 },
        });
        if (!cancelled) {
          setSessions(data.sessions);
          setPagination(data.pagination);
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load exam sessions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const timer = setTimeout(load, search ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, examType, mode, search, page]);

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h2>Exams</h2>
          <p>{pagination.total} exam sessions across all students.</p>
        </div>
      </header>

      <div className="admin-info-banner">
        This platform generates exams on demand from fixed blueprints rather than
        storing separate "exam" records, so this section shows real, live monitoring
        of every exam session taken - not a second exam-authoring engine. See the
        implementation notes for what a configurable exam-builder would require.
      </div>

      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-search-input"
          placeholder="Search by student name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="admin-select" value={examType} onChange={(e) => { setExamType(e.target.value); setPage(1); }}>
          <option value="">All exams</option>
          {EXAM_TYPES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select className="admin-select" value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}>
          <option value="">All modes</option>
          {MODES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {error && <div className="admin-page-error">{error}</div>}

      <div className="panel admin-panel admin-table-panel">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Exam</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Score</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="admin-table-loading">Loading exam sessions...</td></tr>
              )}
              {!loading && sessions.length === 0 && (
                <tr><td colSpan={7} className="admin-table-empty">No exam sessions found.</td></tr>
              )}
              {!loading &&
                sessions.map((s) => (
                  <tr key={s._id}>
                    <td>
                      {s.studentName}
                      <br />
                      <span className="admin-muted">{s.studentEmail}</span>
                    </td>
                    <td>{s.examType}{s.sectionSubject ? ` · ${s.sectionSubject}` : ''}</td>
                    <td>{s.mode}</td>
                    <td>
                      <span className={`admin-badge-pill admin-status-${s.status}`}>{s.status}</span>
                      {s.integrityRisk && <span className="admin-badge-pill admin-badge-danger"> flagged</span>}
                    </td>
                    <td>{s.score != null ? `${s.score}/${s.maxScore}` : '—'}</td>
                    <td>{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '—'}</td>
                    <td>
                      <Link className="admin-link-btn" to={`/admin/exams/${s._id}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};

export default AdminExamsPage;