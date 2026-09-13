const mongoose = require('mongoose');

// Purely additive admin bookkeeping collection. It does NOT replace or gate the
// free-text `topic` field already stored on every Question document (which is what
// the recommendation engine, analytics, and ML analysis all read directly). This
// collection exists so admins can:
//   - catalog a topic before any questions exist for it (planning)
//   - mark a topic "disabled" for admin-side organization
//   - see a single place listing every topic per subject
// Renaming a topic here does NOT rename it on existing Question/Attempt/Mistake/
// Performance documents - those keep whatever topic string they were created with,
// which is intentional: cascading a rename across historical analytics documents
// risks silently corrupting already-computed weak-topic/mastery history.
const topicMetaSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      enum: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

topicMetaSchema.index({ subject: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('TopicMeta', topicMetaSchema);