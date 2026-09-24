import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import Pagination from '../../components/admin/Pagination';
import AdminLearningContentFormModal from '../../components/admin/AdminLearningContentFormModal';

const formatPct = (v) => (v === null || v === undefined ? '-' : `${v}%`);
const formatTime = (sec) => (sec ? `${Math.round(sec / 60)} min` : '-');

const AdminLearningContentPage = () => {
  const { showToast } = useToast() || {};
  const notify = (message, type = 'success') => showToast && showToast(message, { type });

  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ q: '', subject: '', contentType: '', active: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState({ open: false, content: null });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/learning-content', { params: { ...filters, page, limit: 15 } });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load learning content');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get('/admin/learning-content/meta').then((res) => setMeta(res.data)).catch(() => {});
  }, []);

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const openEdit = async (row) => {
    setFormError('');
    try {
      const { data } = await api.get(`/admin/learning-content/${row.id}`); // includes the body
      setModal({ open: true, content: data });
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to open content', 'error');
    }
  };

  const save = async (payload) => {
    setSaving(true);
    setFormError('');
    try {
      if (modal.content) await api.put(`/admin/learning-content/${modal.content.id}`, payload);
      else await api.post('/admin/learning-content', payload);
      notify(modal.content ? 'Content updated' : 'Content added');
      setModal({ open: false, content: null });
      await load();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await api.put(`/admin/learning-content/${row.id}`, { isActive: !row.isActive });
      notify(row.isActive ? 'Content disabled - it will no longer be recommended' : 'Content enabled');
      await load();
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to update content', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/learning-content/${pendingDelete.id}`);
      notify('Content deleted');
      setPendingDelete(null);
      await load();
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to delete content', 'error');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h2>Learning Content</h2>
          <p>Curated resources the recommendation engine can suggest. Only active content is ever recommended.</p>
        </div>
        <button type="button" className="solid-btn" onClick={() => { setFormError(''); setModal({ open: true, content: null }); }}>
          Add content
        </button>
      </header>

      <div className="admin-info-banner">
        Usage figures are aggregates across all students. Topics must match the question bank exactly
        (the form suggests real ones) so recommendations can connect content to student performance.
      </div>

      <div className="admin-toolbar">
        <input className="admin-search-input" type="search" placeholder="Search title, topic or concept" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} aria-label="Search learning content" />
        <select className="admin-select" value={filters.subject} onChange={(e) => setFilter('subject', e.target.value)} aria-label="Filter by subject">
          <option value="">All subjects</option>
          {(meta?.subjects || ['Physics', 'Chemistry', 'Mathematics', 'Biology']).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="admin-select" value={filters.contentType} onChange={(e) => setFilter('contentType', e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          {(meta?.contentTypes || []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="admin-select" value={filters.active} onChange={(e) => setFilter('active', e.target.value)} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </select>
      </div>

      {error && <div className="admin-page-error">{error}</div>}

      <div className="panel admin-panel admin-table-panel">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject / topic</th>
                <th>Type</th>
                <th>Difficulty</th>
                <th>Quality</th>
                <th>Recommended</th>
                <th>Click rate</th>
                <th>Completion</th>
                <th>Helpful</th>
                <th>Avg time</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={12} className="admin-table-loading">Loading content...</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={12} className="admin-table-empty">No learning content found.</td></tr>}
              {!loading && items.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}<br /><small className="admin-muted">{row.provider} · {row.estimatedMinutes} min</small></td>
                  <td>{row.subject}<br /><small className="admin-muted">{row.topic}{row.concept ? ` · ${row.concept}` : ''}</small></td>
                  <td>{row.contentType}<br /><small className="admin-muted">{row.learningStage}</small></td>
                  <td><span className={`admin-difficulty-${row.difficulty.toLowerCase()}`}>{row.difficulty}</span></td>
                  <td>{row.qualityScore}</td>
                  <td>{row.stats?.timesRecommended ?? 0}</td>
                  <td>{formatPct(row.stats?.clickRate)}</td>
                  <td>{formatPct(row.stats?.completionRate)}<br /><small className="admin-muted">{row.stats?.completions ?? 0}/{row.stats?.learners ?? 0}</small></td>
                  <td>{formatPct(row.stats?.helpfulRate)}<br /><small className="admin-muted">{row.stats?.helpfulResponses ?? 0} votes</small></td>
                  <td>{formatTime(row.stats?.avgTimeSpentSec)}</td>
                  <td>
                    <span className={`admin-badge-pill ${row.isActive ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                      {row.isActive ? 'active' : 'disabled'}
                    </span>
                  </td>
                  <td className="admin-row-actions">
                    <button type="button" className="admin-link-btn" onClick={() => openEdit(row)}>Edit</button>
                    <button type="button" className="admin-link-btn" onClick={() => toggleActive(row)}>{row.isActive ? 'Disable' : 'Enable'}</button>
                    <button type="button" className="admin-link-btn admin-link-danger" onClick={() => setPendingDelete(row)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page} totalPages={pagination.pages} total={pagination.total} onPageChange={setPage} />
      </div>

      <AdminLearningContentFormModal
        open={modal.open}
        content={modal.content}
        meta={meta}
        busy={saving}
        errorMessage={formError}
        onClose={() => setModal({ open: false, content: null })}
        onSubmit={save}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this content?"
        message="Content that students have already seen cannot be deleted - disable it instead. Unused content is removed permanently."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default AdminLearningContentPage;