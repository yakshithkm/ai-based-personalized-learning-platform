// Response shapes shared by the recommendation endpoints (keeps every item consistent).

const serializeContent = (content, { includeBody = false } = {}) => {
  if (!content) return null;
  const out = {
    id: String(content._id),
    title: content.title,
    description: content.description || '',
    contentType: content.contentType,
    learningStage: content.learningStage,
    subject: content.subject,
    topic: content.topic,
    subtopic: content.subtopic || 'General',
    concept: content.concept || '',
    difficulty: content.difficulty,
    estimatedMinutes: content.estimatedMinutes,
    provider: content.provider,
    url: content.url || '',
    hasBody: Boolean(content.body),
    learningObjectives: content.learningObjectives || [],
    tags: content.tags || [],
    language: content.language || 'en',
    examTypes: content.examTypes || [],
  };
  if (includeBody) out.body = content.body || '';
  return out;
};

const serializeProgress = (progress) =>
  progress
    ? {
        status: progress.status,
        progressPercent: progress.progressPercent || 0,
        timeSpentSec: progress.timeSpentSec || 0,
        startedAt: progress.startedAt || null,
        completedAt: progress.completedAt || null,
        lastAccessedAt: progress.lastAccessedAt || null,
        helpful: progress.helpful ?? null,
        difficultyFeedback: progress.difficultyFeedback ?? null,
        rating: progress.rating ?? null,
      }
    : null;

const serializeRecommendation = (rec) => ({
  id: String(rec._id),
  kind: rec.kind,
  contentId: rec.content ? String(rec.content) : null,
  target: rec.target,
  recommendationReason: rec.recommendationReason,
  reason: rec.reason,
  priority: rec.priority,
  score: rec.score,
  stage: rec.stage,
  contentGap: Boolean(rec.contentGap),
  status: rec.status,
  recommendedAt: rec.recommendedAt,
  clickedAt: rec.clickedAt || null,
  startedAt: rec.startedAt || null,
  completedAt: rec.completedAt || null,
  timeSpentSec: rec.timeSpentSec || 0,
  feedback: rec.feedback || null,
});

module.exports = { serializeContent, serializeProgress, serializeRecommendation };