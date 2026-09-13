import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/admin/ConfirmDialog';

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

const AdminTopicsPage = () => {
  const { showToast } = useToast() || {};
  const [topics, setTopics] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ subject: 'Physics', name: '', notes: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const notify = (message, type = 'success') => showToast && showToast(message, { type });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/topics', { params: { subject: subjectFilter } });
      setTopics(data.topics);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectFilter]);

  const createTopic = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!form.name.trim()) {
      setCreateError('Topic name is required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/admin/topics', form);
      notify('Topic created successfully');
      setForm({ subject: form.subject, name: '', notes: '' });
      await load();
    } catch (err) {
      setCreateError(err?.response?.data?.message || 'Failed to create topic');
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (topic) => {
    try {
      await api.put(`/admin/topics/${topic._id}`, {
        status: topic.status === 'active' ? 'disabled' : 'active',
      });
      notify(`Topic ${topic.status === 'active' ? 'disabled' : 'enabled'}`);
      await load();
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to update topic', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/topics/${pendingDelete._id}`);
      notify('Topic deleted successfully');
      setPendingDelete(null);
      await load();
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to delete topic', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h2>Topics</h2>
          <p>Catalog of topics per subject, with live question counts.</p>
        </div>
      </header>

      <div className="admin-info-banner">
        Editing a topic's name here is intentionally not supported - it would desync
        the catalog from the actual questions and historical analytics that already
        reference the original topic name. Delete and recreate if you need to rename.
      </div>

      <div className="panel admin-panel admin-form-panel">
        <h3>Add a Topic</h3>
        <form onSubmit={createTopic} className="admin-inline-form">
          <select value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Topic name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <button type="submit" className="solid-btn" disabled={creating}>
            {creating ? 'Adding...' : 'Add Topic'}
          </button>
        </form>
        {createError && <div className="error-text">{createError}</div>}
      </div>

      <div className="admin-toolbar">
        <select className="admin-select" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="">All subjects</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {error && <div className="admin-page-error">{error}</div>}

      <div className="panel admin-panel admin-table-panel">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Topic</th>
                <th>Questions</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="admin-table-loading">Loading topics...</td></tr>
              )}
              {!loading && topics.length === 0 && (
                <tr><td colSpan={5} className="admin-table-empty">No topics found.</td></tr>
              )}
              {!loading &&
                topics.map((t) => (
                  <tr key={`${t.subject}-${t.name}`}>
                    <td>{t.subject}</td>
                    <td>
                      {t.name}
                      {!t.catalogued && <span className="admin-muted"> (auto-detected)</span>}
                    </td>
                    <td>{t.questionCount}</td>
                    <td>
                      <span className={`admin-badge-pill ${t.status === 'active' ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                        {t.catalogued ? t.status : 'uncatalogued'}
                      </span>
                    </td>
                    <td className="admin-row-actions">
                      {t.catalogued ? (
                        <>
                          <button type="button" className="admin-link-btn" onClick={() => toggleStatus(t)}>
                            {t.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            className="admin-link-btn admin-link-danger"
                            onClick={() => setPendingDelete(t)}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="admin-muted">Not catalogued</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this topic?"
        message={
          pendingDelete?.questionCount > 0
            ? `This topic still has ${pendingDelete.questionCount} question(s) - deletion will be blocked until they're reassigned or removed.`
            : 'This will remove the topic from the catalog.'
        }
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default AdminTopicsPage;