import { useEffect, useState } from 'react';

// Mirrors backend/src/config/examSubjectMap.js so an exam checkbox is only offered when the
// exam actually includes the chosen subject (NEET: PCB, JEE: PCM, CET: all four).
const EXAM_SUBJECT_MAP = {
  NEET: ['Physics', 'Chemistry', 'Biology'],
  JEE: ['Physics', 'Chemistry', 'Mathematics'],
  CET: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};
const examsForSubject = (subject) => Object.keys(EXAM_SUBJECT_MAP).filter((e) => EXAM_SUBJECT_MAP[e].includes(subject));

const FALLBACK_META = {
  subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  difficulties: ['Easy', 'Medium', 'Hard'],
  contentTypes: ['video', 'article', 'notes', 'concept', 'example', 'quiz', 'practice', 'revision', 'formula-sheet'],
  learningStages: ['introduction', 'explanation', 'worked-example', 'practice', 'revision', 'advanced'],
  topicsBySubject: {},
};

const emptyForm = {
  title: '',
  description: '',
  subject: 'Physics',
  examTypes: ['NEET', 'JEE', 'CET'],
  topic: '',
  subtopic: '',
  concept: '',
  contentType: 'concept',
  learningStage: '',
  difficulty: 'Medium',
  estimatedMinutes: 10,
  provider: 'TutorMind',
  url: '',
  body: '',
  prerequisites: '',
  learningObjectives: '',
  tags: '',
  qualityScore: 70,
  isActive: true,
};

const fromContent = (c) => ({
  ...emptyForm,
  ...c,
  subtopic: c.subtopic === 'General' ? '' : c.subtopic || '',
  learningStage: c.learningStage || '',
  prerequisites: (c.prerequisites || []).join(', '),
  learningObjectives: (c.learningObjectives || []).join('\n'),
  tags: (c.tags || []).join(', '),
  url: c.url || '',
  body: c.body || '',
});

const AdminLearningContentFormModal = ({ open, content, meta, onClose, onSubmit, busy, errorMessage }) => {
  const m = meta || FALLBACK_META;
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) setForm(content ? fromContent(content) : emptyForm);
  }, [open, content]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const allowedExams = examsForSubject(form.subject);
  const topics = m.topicsBySubject?.[form.subject] || [];

  const changeSubject = (subject) =>
    setForm((f) => ({ ...f, subject, examTypes: f.examTypes.filter((e) => examsForSubject(subject).includes(e)) }));

  const toggleExam = (exam) =>
    set('examTypes', form.examTypes.includes(exam) ? form.examTypes.filter((e) => e !== exam) : [...form.examTypes, exam]);

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      title: form.title,
      description: form.description,
      subject: form.subject,
      examTypes: form.examTypes,
      topic: form.topic,
      subtopic: form.subtopic,
      concept: form.concept,
      contentType: form.contentType,
      learningStage: form.learningStage || undefined,
      difficulty: form.difficulty,
      estimatedMinutes: Number(form.estimatedMinutes),
      provider: form.provider,
      url: form.url,
      body: form.body,
      prerequisites: form.prerequisites,
      learningObjectives: form.learningObjectives,
      tags: form.tags,
      qualityScore: Number(form.qualityScore),
      isActive: form.isActive,
    });
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="admin-modal admin-question-modal" role="dialog" aria-modal="true" aria-label={content ? 'Edit learning content' : 'Add learning content'} onClick={(e) => e.stopPropagation()}>
        <h3>{content ? 'Edit Learning Content' : 'Add Learning Content'}</h3>
        <form onSubmit={submit} className="admin-form">
          <label>
            Title
            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} required />
          </label>
          <label>
            Description
            <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} />
          </label>

          <div className="admin-form-row">
            <label>
              Subject
              <select value={form.subject} onChange={(e) => changeSubject(e.target.value)}>
                {m.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Topic
              <input type="text" list="lc-topics" value={form.topic} onChange={(e) => set('topic', e.target.value)} required />
              <datalist id="lc-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
          </div>

          <div className="admin-form-row">
            <label>
              Subtopic (optional)
              <input type="text" value={form.subtopic} onChange={(e) => set('subtopic', e.target.value)} />
            </label>
            <label>
              Concept (optional)
              <input type="text" value={form.concept} onChange={(e) => set('concept', e.target.value)} />
            </label>
          </div>

          <fieldset className="admin-form-fieldset">
            <legend>Applies to exams</legend>
            {allowedExams.map((exam) => (
              <label key={exam} className="admin-inline-check">
                <input type="checkbox" checked={form.examTypes.includes(exam)} onChange={() => toggleExam(exam)} /> {exam}
              </label>
            ))}
            <small className="admin-muted"> None selected = all exams that include this subject.</small>
          </fieldset>

          <div className="admin-form-row">
            <label>
              Content type
              <select value={form.contentType} onChange={(e) => set('contentType', e.target.value)}>
                {m.contentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>
              Learning stage
              <select value={form.learningStage} onChange={(e) => set('learningStage', e.target.value)}>
                <option value="">Auto (from type and difficulty)</option>
                {m.learningStages.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Difficulty
              <select value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
                {m.difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>

          <div className="admin-form-row">
            <label>
              Estimated minutes
              <input type="number" min={1} max={240} value={form.estimatedMinutes} onChange={(e) => set('estimatedMinutes', e.target.value)} />
            </label>
            <label>
              Quality score (0-100)
              <input type="number" min={0} max={100} value={form.qualityScore} onChange={(e) => set('qualityScore', e.target.value)} />
            </label>
            <label>
              Provider
              <input type="text" value={form.provider} onChange={(e) => set('provider', e.target.value)} maxLength={80} />
            </label>
          </div>

          <label>
            URL (http/https) - leave empty for in-app content
            <input type="url" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" />
          </label>
          <label>
            In-app body (simple markdown) - required when there is no URL
            <textarea rows={6} value={form.body} onChange={(e) => set('body', e.target.value)} />
          </label>
          <label>
            Prerequisites (topic or concept names, comma separated)
            <input type="text" value={form.prerequisites} onChange={(e) => set('prerequisites', e.target.value)} />
          </label>
          <label>
            Learning objectives (one per line)
            <textarea rows={3} value={form.learningObjectives} onChange={(e) => set('learningObjectives', e.target.value)} />
          </label>
          <label>
            Tags (comma separated)
            <input type="text" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
          </label>
          <label className="admin-inline-check">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active (only active content is ever recommended)
          </label>

          {errorMessage && <div className="error-text" role="alert">{errorMessage}</div>}

          <div className="admin-modal-actions">
            <button type="button" className="outline-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="solid-btn" disabled={busy}>{busy ? 'Saving...' : content ? 'Save changes' : 'Add content'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLearningContentFormModal;