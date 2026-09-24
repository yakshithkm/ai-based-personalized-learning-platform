const { PATH_TEMPLATES, STAGE_LABELS } = require('./constants');

const practiceLabel = (p) =>
  `${p.count} ${p.difficulty || 'Mixed'} Questions${p.yearTag ? ' (previous-year, timed)' : ''}`;

/**
 * Learning path for one target: the level's progression template
 * (introduction -> explanation/example -> practice ...), with each content step filled by a
 * real active resource for that stage when one exists. Stages with no resource are omitted
 * rather than faked; practice steps always come from the question bank.
 */
const buildPath = ({ need, level, topicContents, rankedById, profile, primary }) => {
  const template = PATH_TEMPLATES[level] || PATH_TEMPLATES.developing;
  const avgSec = Math.min(180, Math.max(30, Number(profile.topics.get(`${need.subject}::${String(need.topic).trim().toLowerCase()}`)?.avgTime) || 60));

  const steps = [];
  template.forEach((entry) => {
    if (entry.practice) {
      steps.push({
        kind: 'practice',
        stage: 'practice',
        label: practiceLabel(entry.practice),
        count: entry.practice.count,
        difficulty: entry.practice.difficulty,
        minutes: Math.max(3, Math.ceil((entry.practice.count * avgSec) / 60)),
        status: 'upcoming',
      });
      return;
    }

    const inStage = topicContents.filter((c) => c.learningStage === entry.stage);
    if (!inStage.length) return;
    const doneOne = inStage.find((c) => profile.progressByContent.get(String(c._id))?.status === 'completed');
    let chosen = doneOne;
    if (!chosen) {
      chosen = inStage
        .filter((c) => profile.progressByContent.get(String(c._id))?.status !== 'skipped')
        .sort(
          (a, b) =>
            (rankedById.get(String(b._id))?.score || 0) - (rankedById.get(String(a._id))?.score || 0) ||
            Number(b.qualityScore || 0) - Number(a.qualityScore || 0)
        )[0];
    }
    if (!chosen) return;
    const progress = profile.progressByContent.get(String(chosen._id));
    steps.push({
      kind: 'content',
      stage: entry.stage,
      stageLabel: STAGE_LABELS[entry.stage],
      contentId: String(chosen._id),
      title: chosen.title,
      contentType: chosen.contentType,
      minutes: chosen.estimatedMinutes,
      status: doneOne ? 'completed' : progress?.status === 'in-progress' ? 'in-progress' : 'upcoming',
    });
  });

  // The recommended primary resource must appear even if the need-specific preferred stage
  // (e.g. a stagnation-break worked example) is not part of the level template.
  if (primary && !steps.some((s) => s.contentId === String(primary._id))) {
    steps.unshift({
      kind: 'content',
      stage: primary.learningStage,
      stageLabel: STAGE_LABELS[primary.learningStage],
      contentId: String(primary._id),
      title: primary.title,
      contentType: primary.contentType,
      minutes: primary.estimatedMinutes,
      status: profile.progressByContent.get(String(primary._id))?.status === 'in-progress' ? 'in-progress' : 'upcoming',
    });
  }

  const nextIndex = steps.findIndex((s) => s.status !== 'completed');
  if (nextIndex !== -1 && steps[nextIndex].status === 'upcoming') steps[nextIndex].status = 'next';
  return steps.map((s, i) => ({ order: i + 1, ...s }));
};

module.exports = { buildPath };