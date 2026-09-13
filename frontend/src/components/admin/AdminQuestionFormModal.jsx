import { useEffect, useState } from 'react';

const EXAM_TYPES = ['NEET', 'JEE', 'CET'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

// Mirrors backend/src/config/examSubjectMap.js - keeps the subject dropdown from
// ever offering a combination the create/update endpoint would reject.
const EXAM_SUBJECT_MAP = {
  NEET: ['Physics', 'Chemistry', 'Biology'],
  JEE: ['Physics', 'Chemistry', 'Mathematics'],
  CET: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};
const subjectsForExam = (exam) => EXAM_SUBJECT_MAP[exam] || ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

const emptyForm = {
  examType: 'JEE',
  subject: 'Physics',
  topic: '',
  subtopic: '',
  difficulty: 'Medium',
  text: '',
  options: ['', '', '', ''],
  correctAnswerIndex: 0,
  explanation: '',
};

const AdminQuestionFormModal = ({ open, question, onClose, onSubmit, busy, errorMessage }) => {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (question) {
      setForm({
        examType: question.examType,
        subject: question.subject,
        topic: question.topic,
        subtopic: question.subtopic || '',
        difficulty: question.difficulty,
        text: question.text,
        options: question.options?.length === 4 ? question.options : ['', '', '', ''],
        correctAnswerIndex: question.correctAnswerIndex ?? 0,
        explanation: question.explanation || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [question, open]);

  if (!open) return null;

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setOption = (idx, value) => {
    const options = [...form.options];
    options[idx] = value;
    setForm((prev) => ({ ...prev, options }));
  };

  const submit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal admin-question-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{question ? 'Edit Question' : 'Add Question'}</h3>

        <form onSubmit={submit} className="admin-form">
          <div className="admin-form-row">
            <label>
              Exam Type
              <select
                value={form.examType}
                onChange={(e) => {
                  const nextExam = e.target.value;
                  const allowed = subjectsForExam(nextExam);
                  setForm((prev) => ({
                    ...prev,
                    examType: nextExam,
                    subject: allowed.includes(prev.subject) ? prev.subject : allowed[0],
                  }));
                }}
              >
                {EXAM_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <select value={form.subject} onChange={(e) => setField('subject', e.target.value)}>
                {subjectsForExam(form.examType).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Difficulty
              <select value={form.difficulty} onChange={(e) => setField('difficulty', e.target.value)}>
                {DIFFICULTIES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-form-row">
            <label>
              Topic
              <input
                type="text"
                value={form.topic}
                onChange={(e) => setField('topic', e.target.value)}
                placeholder="e.g. Kinematics"
                required
              />
            </label>
            <label>
              Subtopic (optional)
              <input
                type="text"
                value={form.subtopic}
                onChange={(e) => setField('subtopic', e.target.value)}
                placeholder="Defaults to topic"
              />
            </label>
          </div>

          <label>
            Question Text
            <textarea
              rows={3}
              value={form.text}
              onChange={(e) => setField('text', e.target.value)}
              required
            />
          </label>

          <div className="admin-options-grid">
            {form.options.map((opt, idx) => (
              <label key={idx} className="admin-option-field">
                <span>
                  <input
                    type="radio"
                    name="correctAnswerIndex"
                    checked={form.correctAnswerIndex === idx}
                    onChange={() => setField('correctAnswerIndex', idx)}
                  />
                  Option {String.fromCharCode(65 + idx)}
                  {form.correctAnswerIndex === idx && <em> (correct)</em>}
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => setOption(idx, e.target.value)}
                  required
                />
              </label>
            ))}
          </div>

          <label>
            Explanation (optional)
            <textarea
              rows={2}
              value={form.explanation}
              onChange={(e) => setField('explanation', e.target.value)}
            />
          </label>

          {errorMessage && <div className="error-text">{errorMessage}</div>}

          <div className="admin-modal-actions">
            <button type="button" className="outline-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="solid-btn" disabled={busy}>
              {busy ? 'Saving...' : question ? 'Save Changes' : 'Create Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminQuestionFormModal;