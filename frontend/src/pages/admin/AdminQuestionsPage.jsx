import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Pagination from '../../components/admin/Pagination';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminQuestionFormModal from '../../components/admin/AdminQuestionFormModal';

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const EXAM_TYPES = ['NEET', 'JEE', 'CET'];

// Mirrors backend/src/config/examSubjectMap.js exactly - NEET is PCB-only, JEE is
// PCM-only, CET spans all four. Kept in sync here so the filter (and the Add/Edit
// form) never offers a subject the create/update endpoint would reject.
const EXAM_SUBJECT_MAP = {
  NEET: ['Physics', 'Chemistry', 'Biology'],
  JEE: ['Physics', 'Chemistry', 'Mathematics'],
  CET: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};
const subjectsForExam = (exam) => EXAM_SUBJECT_MAP[exam] || SUBJECTS;

const AdminQuestionsPage = () => {
  const { showToast } = useToast() || {};
  const [questions, setQuestions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [examType, setExamType] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const notify = (message, type = 'success') => {
    if (showToast) showToast(message, { type });
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/questions', {
        params: { search, subject, difficulty, examType, page, pageSize: 15 },
      });
      setQuestions(data.questions);
      setPagination(data.pagination);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, subject, difficulty, examType, page]);

  const openCreate = () => {
    setEditingQuestion(null);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (question) => {
    setEditingQuestion(question);
    setFormError('');
    setModalOpen(true);
  };

  const submitForm = async (form) => {
    setSaving(true);
    setFormError('');
    try {
      if (editingQuestion) {
        await api.put(`/admin/questions/${editingQuestion._id}`, form);
        notify('Question updated successfully');
      } else {
        await api.post('/admin/questions', form);
        notify('Question created successfully');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/questions/${pendingDelete._id}`);
      notify('Question deleted successfully');
      setPendingDelete(null);
      await load();
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to delete question', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h2>Question Bank</h2>
          <p>{pagination.total} questions across all subjects.</p>
        </div>
        <button type="button" className="solid-btn" onClick={openCreate}>
          + Add Question
        </button>
      </header>

      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-search-input"
          placeholder="Search question text..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="admin-select"
          value={examType}
          onChange={(e) => {
            const nextExam = e.target.value;
            setExamType(nextExam);
            // If the currently-selected subject isn't valid for the newly
            // chosen exam (e.g. Biology was selected, then switching to JEE),
            // reset it rather than silently filtering to a combination that
            // can never match anything.
            if (subject && nextExam && !subjectsForExam(nextExam).includes(subject)) {
              setSubject('');
            }
            setPage(1);
          }}
        >
          <option value="">All exams</option>
          {EXAM_TYPES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select className="admin-select" value={subject} onChange={(e) => { setSubject(e.target.value); setPage(1); }}>
          <option value="">All subjects</option>
          {subjectsForExam(examType).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select className="admin-select" value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}>
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {error && <div className="admin-page-error">{error}</div>}

      <div className="panel admin-panel admin-table-panel">
        <div className="admin-table-scroll">
          <table className="admin-table admin-table-fixed">
            <colgroup>
              <col style={{ width: '40%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Question</th>
                <th>Subject</th>
                <th>Topic</th>
                <th>Difficulty</th>
                <th className="admin-col-exam">Exam</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="admin-table-loading">Loading questions...</td>
                </tr>
              )}
              {!loading && questions.length === 0 && (
                <tr>
                  <td colSpan={6} className="admin-table-empty">No questions match your filters.</td>
                </tr>
              )}
              {!loading &&
                questions.map((q) => (
                  <tr key={q._id}>
                    <td className="admin-question-text-cell">
                      <span className="admin-question-text-truncate" title={q.text}>
                        {q.text}
                      </span>
                    </td>
                    <td>{q.subject}</td>
                    <td>{q.topic}</td>
                    <td>
                      <span className={`admin-badge-pill admin-difficulty-${q.difficulty?.toLowerCase()}`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="admin-col-exam">{q.examType}</td>
                    <td className="admin-row-actions">
                      <button type="button" className="admin-link-btn" onClick={() => openEdit(q)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-link-btn admin-link-danger"
                        onClick={() => setPendingDelete(q)}
                      >
                        Delete
                      </button>
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

      <AdminQuestionFormModal
        open={modalOpen}
        question={editingQuestion}
        onClose={() => setModalOpen(false)}
        onSubmit={submitForm}
        busy={saving}
        errorMessage={formError}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this question?"
        message="This cannot be undone. Historical attempt records for this question will be preserved, but it will no longer appear in the question bank or future exams."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default AdminQuestionsPage;