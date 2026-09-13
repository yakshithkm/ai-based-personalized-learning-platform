import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import Pagination from '../../components/admin/Pagination';

const AdminStudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [targetExam, setTargetExam] = useState('');
  const [sortBy, setSortBy] = useState('registeredAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/admin/students', {
          params: { search, targetExam, sortBy, order, page, pageSize: 20 },
        });
        if (!cancelled) {
          setStudents(data.students);
          setPagination(data.pagination);
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load students');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const timer = setTimeout(load, search ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, targetExam, sortBy, order, page]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setOrder('desc');
    }
    setPage(1);
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h2>Students</h2>
          <p>{pagination.total} registered students.</p>
        </div>
      </header>

      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-search-input"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="admin-select"
          value={targetExam}
          onChange={(e) => {
            setTargetExam(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All exams</option>
          <option value="NEET">NEET</option>
          <option value="JEE">JEE</option>
          <option value="CET">CET</option>
        </select>
      </div>

      {error && <div className="admin-page-error">{error}</div>}

      <div className="panel admin-panel admin-table-panel">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')} className="admin-sortable">
                  Name {sortBy === 'name' && (order === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => toggleSort('email')} className="admin-sortable">
                  Email {sortBy === 'email' && (order === 'asc' ? '↑' : '↓')}
                </th>
                <th>Exam</th>
                <th onClick={() => toggleSort('registeredAt')} className="admin-sortable">
                  Registered {sortBy === 'registeredAt' && (order === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => toggleSort('overallAccuracy')} className="admin-sortable">
                  Accuracy {sortBy === 'overallAccuracy' && (order === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => toggleSort('currentStreak')} className="admin-sortable">
                  Streak {sortBy === 'currentStreak' && (order === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => toggleSort('totalAttempts')} className="admin-sortable">
                  Attempts {sortBy === 'totalAttempts' && (order === 'asc' ? '↑' : '↓')}
                </th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="admin-table-loading">
                    Loading students...
                  </td>
                </tr>
              )}
              {!loading && students.length === 0 && (
                <tr>
                  <td colSpan={9} className="admin-table-empty">
                    No students match your filters.
                  </td>
                </tr>
              )}
              {!loading &&
                students.map((student) => (
                  <tr key={student._id}>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.targetExam}</td>
                    <td>{new Date(student.registeredAt).toLocaleDateString()}</td>
                    <td>{student.overallAccuracy}%</td>
                    <td>{student.currentStreak}</td>
                    <td>{student.totalAttempts}</td>
                    <td>
                      <span
                        className={`admin-badge-pill ${
                          student.status === 'active' ? 'admin-badge-success' : 'admin-badge-neutral'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td>
                      <Link className="admin-link-btn" to={`/admin/students/${student._id}`}>
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

export default AdminStudentsPage;