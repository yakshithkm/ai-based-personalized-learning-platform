const mongoose = require('mongoose');
const {
  EXAM_TYPES,
  SUBJECTS,
  DIFFICULTIES,
  CONTENT_TYPES,
  LEARNING_STAGES,
  CONTENT_TYPE_STAGE,
} = require('../services/learning/constants');

const isHttpUrl = (value) => {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

// A curated learning resource. Provider-agnostic on purpose: a resource is either an
// external link (`url`, http/https only) or internal TutorMind content (`body`, rendered
// in-app), and `provider` is just a label - the recommendation engine never branches on it.
// Only `isActive` resources are ever recommended, and nothing here is LLM-generated.
const learningContentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },

    // Empty array = applicable to every exam. (An array rather than a single value
    // because one resource usually serves several exams - the question bank itself is
    // duplicated per exam for the same reason.)
    examTypes: { type: [{ type: String, enum: EXAM_TYPES }], default: [] },
    subject: { type: String, enum: SUBJECTS, required: true },
    topic: { type: String, required: true, trim: true },
    subtopic: { type: String, default: 'General', trim: true },
    concept: { type: String, default: '', trim: true },

    contentType: { type: String, enum: CONTENT_TYPES, required: true },
    // Position on the learning progression. Derived from contentType (and difficulty for
    // notes/articles/videos) on save unless an admin sets it explicitly.
    learningStage: { type: String, enum: LEARNING_STAGES },
    difficulty: { type: String, enum: DIFFICULTIES, default: 'Medium' },

    url: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
      validate: { validator: isHttpUrl, message: 'url must be a valid http(s) URL' },
    },
    // Internal content rendered in-app with the lightweight markdown renderer.
    body: { type: String, default: '', maxlength: 20000 },
    provider: { type: String, default: 'TutorMind', trim: true, maxlength: 80 },

    estimatedMinutes: { type: Number, default: 10, min: 1, max: 240 },

    // Lightweight prerequisite links: names of topics or concepts (same subject) the
    // student should have a working grasp of first. Resolved by name at ranking time.
    prerequisites: { type: [{ type: String, trim: true }], default: [] },
    learningObjectives: { type: [{ type: String, trim: true }], default: [] },
    tags: { type: [{ type: String, trim: true }], default: [] },
    language: { type: String, default: 'en', trim: true, maxlength: 10 },

    // Admin-assigned editorial quality (0-100). popularityScore is stored for admin
    // reporting only; the ranking formula deliberately does not use it.
    qualityScore: { type: Number, default: 70, min: 0, max: 100 },
    popularityScore: { type: Number, default: 0, min: 0, max: 100 },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

learningContentSchema.pre('validate', function deriveStageAndCheckSource(next) {
  if (!this.learningStage) {
    let stage = CONTENT_TYPE_STAGE[this.contentType] || 'explanation';
    if (this.difficulty === 'Hard' && ['explanation', 'worked-example'].includes(stage)) {
      stage = 'advanced';
    }
    this.learningStage = stage;
  }

  if (!String(this.url || '').trim() && !String(this.body || '').trim()) {
    this.invalidate('url', 'Provide either a url or an internal body');
  }
  next();
});

// Candidate retrieval: active content for a subject/topic (+ exam filter).
learningContentSchema.index({ isActive: 1, subject: 1, topic: 1 });
learningContentSchema.index({ examTypes: 1, subject: 1, topic: 1, isActive: 1 });
// Idempotent seeding / duplicate prevention.
learningContentSchema.index({ provider: 1, title: 1, subject: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model('LearningContent', learningContentSchema);