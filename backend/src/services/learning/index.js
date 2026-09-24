const LearningContent = require('../../models/LearningContent');
const LearningRecommendation = require('../../models/LearningRecommendation');
const { getAllowedSubjectsForExam } = require('../../config/examSubjectMap');
const {
  PATH_TEMPLATES,
  DEFAULT_PRACTICE_COUNT,
  BASELINE_ATTEMPTS_NEEDED,
} = require('./constants');
const {
  buildLearnerProfile,
  isPseudoTopic,
  topicKey,
  norm,
} = require('./learnerProfile');
const { detectNeeds, derivePrerequisiteNeeds, makeNeed } = require('./needDetection');
const { rankContents, scoreContent, scorePracticeOnly, targetDifficulty } = require('./ranking');
const { buildContentExplanation, buildPracticeExplanation } = require('./explanations');
const { buildPath } = require('./learningPath');
const { buildDailyPlan } = require('./dailyPlan');
const { recordServed } = require('./history');
const { evaluateEffectiveness } = require('./effectiveness');
const { serializeContent, serializeProgress } = require('./serializers');
const { polishExplanation, isEnabled: aiEnabled } = require('./aiExplainer');

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SCORE = 20; // resources scoring below this are not worth surfacing
const PRACTICE_GAP_TYPES = [
  'weak-topic',
  'weak-concept',
  'mistake-recovery',
  'prerequisite',
  'new-topic',
  'cold-start',
  'advanced-challenge',
];

const SECTION_KEYS = [
  'learnNext',
  'weakAreas',
  'mistakeRecovery',
  'continueLearning',
  'practiceAfterLearning',
  'challenges',
  'exploreNew',
  'dailyPlan',
  'improvements',
];

const SECTION_META = {
  learnNext: { title: 'Learn Next', description: 'The single most valuable thing to study right now.' },
  weakAreas: { title: 'Review Your Weak Areas', description: 'Material for concepts where your accuracy is below target.' },
  mistakeRecovery: { title: 'Fix Your Mistakes', description: 'Material behind mistakes you keep making or are due to review.' },
  continueLearning: { title: 'Continue Learning', description: 'Resources you started but have not finished.' },
  practiceAfterLearning: { title: 'Practice After Learning', description: 'Test what you recently completed.' },
  challenges: { title: 'Challenge Yourself', description: 'Advanced material for topics you have mastered.' },
  exploreNew: { title: 'Explore New Topics', description: 'Syllabus areas you have not touched yet.' },
};

const SECTION_TYPES = {
  weakAreas: ['weak-topic', 'weak-concept', 'prerequisite', 'stagnation-break'],
  mistakeRecovery: ['mistake-recovery', 'spaced-review'],
  challenges: ['advanced-challenge'],
  exploreNew: ['new-topic', 'cold-start'],
};
const SECTION_LIMITS = { weakAreas: 4, mistakeRecovery: 4, challenges: 3, exploreNew: 3 };

// --- candidate retrieval ---------------------------------------------------------------------
// One indexed query for every (subject, topic) the student has a need in; body text is
// excluded from list queries (it is only served when a resource is opened).
const retrieveContents = async (examType, needs) => {
  const seen = new Set();
  const pairs = [];
  needs.forEach((need) => {
    const key = `${need.subject}::${need.topic}`;
    if (seen.has(key) || pairs.length >= 40) return;
    seen.add(key);
    pairs.push({ subject: need.subject, topic: need.topic });
  });
  if (!pairs.length) return [];
  return LearningContent.find({
    isActive: true,
    $and: [{ $or: pairs }, { $or: [{ examTypes: examType }, { examTypes: { $size: 0 } }] }],
  })
    .select('-body')
    .limit(400)
    .lean();
};

// --- cold start ------------------------------------------------------------------------------
const coldNeed = (row) =>
  makeNeed({
    type: 'cold-start',
    subject: row.subject,
    topic: row.topic,
    level: 'new',
    urgency: row.weightage === 'High' ? 0.6 : row.weightage === 'Medium' ? 0.5 : 0.4,
    signals: { attempts: 0, level: 'new', weightage: row.weightage },
    extra: { weightage: row.weightage, pyqShare: row.pyqShare },
  });

// Balanced starting path: one high-weightage topic per subject of the target exam, preferring
// topics that already have introductory study material.
const buildColdStart = async (profile, user) => {
  const subjects = getAllowedSubjectsForExam(user.targetExam);
  const candidates = subjects.flatMap((subject) =>
    profile.syllabus.filter((s) => s.subject === subject && !isPseudoTopic(s.topic)).slice(0, 3)
  );
  const contents = await retrieveContents(user.targetExam, candidates.map(coldNeed));
  const withContent = new Set(contents.map((c) => topicKey(c.subject, c.topic)));

  const chosen = subjects
    .map((subject) => {
      const rows = candidates.filter((c) => c.subject === subject);
      return rows.find((r) => withContent.has(topicKey(r.subject, r.topic))) || rows[0];
    })
    .filter(Boolean);

  return {
    needs: chosen.map(coldNeed),
    contents: contents.filter((c) => chosen.some((ch) => ch.subject === c.subject && norm(ch.topic) === norm(c.topic))),
    startingPath: chosen.map((row) => ({
      subject: row.subject,
      topic: row.topic,
      weightage: row.weightage,
      hasStudyMaterial: withContent.has(topicKey(row.subject, row.topic)),
    })),
  };
};

// --- pre-items (recommendation before it has a persisted id) ---------------------------------
const beforeSnapshot = (stat, now) => ({
  accuracy: stat ? stat.recentAccuracy ?? stat.accuracy ?? null : null,
  attempts: stat?.attempts || 0,
  mastery: stat?.mastery ?? null,
  capturedAt: now,
});

const targetFromNeed = (need) => ({
  subject: need.subject,
  topic: need.topic,
  subtopic: need.subtopic || 'General',
  concept: need.granularity === 'concept' ? need.concept : '',
  granularity: need.granularity,
});

const practiceStepFor = (level) =>
  (PATH_TEMPLATES[level] || PATH_TEMPLATES.developing).find((s) => s.practice)?.practice || { count: 5, difficulty: 'Medium' };

const practiceMinutes = (profile, need, count) => {
  const stat = profile.topics.get(topicKey(need.subject, need.topic));
  const avg = Math.min(180, Math.max(30, Number(stat?.avgTime) || 60));
  return Math.max(3, Math.ceil((count * avg) / 60));
};

const contentPre = (entry, profile, now) => {
  const { content, need } = entry;
  const stat = entry.stat;
  return {
    dedupeKey: `c:${content._id}`,
    kind: 'content',
    content: content,
    contentId: String(content._id),
    target: targetFromNeed(need),
    recommendationReason: need.type,
    reason: buildContentExplanation({ need, content, matchLevel: entry.matchLevel }),
    priority: entry.priority,
    score: entry.score,
    stage: content.learningStage,
    contentGap: false,
    signals: { ...need.signals, level: need.level, matchLevel: entry.matchLevel },
    before: beforeSnapshot(stat, now),
    practice: { count: DEFAULT_PRACTICE_COUNT, difficulty: practiceStepFor(need.level).difficulty || null },
    need,
    components: entry.components,
    penalties: entry.penalties,
  };
};

const practicePre = (need, profile, now) => {
  const scored = scorePracticeOnly({ need, profile });
  const step = practiceStepFor(need.level);
  const stat = profile.topics.get(topicKey(need.subject, need.topic));
  return {
    dedupeKey: `p:${need.subject}::${norm(need.topic)}::${norm(need.granularity === 'concept' ? need.concept : '')}`,
    kind: 'practice',
    content: null,
    contentId: null,
    target: targetFromNeed(need),
    recommendationReason: need.type,
    reason: buildPracticeExplanation({ need, difficulty: step.difficulty }),
    priority: scored.priority,
    score: scored.score,
    stage: 'practice',
    contentGap: true,
    signals: { ...need.signals, level: need.level, matchLevel: 'topic' },
    before: beforeSnapshot(stat, now),
    practice: { count: step.count, difficulty: step.difficulty || null, minutes: practiceMinutes(profile, need, step.count) },
    need,
    components: scored.components,
    penalties: {},
  };
};

// --- main entry point ------------------------------------------------------------------------
/**
 * Learning-content recommendation pipeline:
 *   profile -> needs -> candidate retrieval -> (prerequisite expansion) -> deterministic ranking
 *   -> sections + learning path + daily plan -> persisted history.
 * Works entirely without an LLM; `aiExplainer` only rephrases the single top explanation.
 */
const getLearningBundle = async (user, options = {}) => {
  const now = options.now || new Date();
  const requested = new Set(options.sections && options.sections.length ? options.sections : SECTION_KEYS);
  const profile = await buildLearnerProfile(user, { now });
  const mode =
    profile.totalAttempts === 0 ? 'cold-start' : profile.totalAttempts < BASELINE_ATTEMPTS_NEEDED ? 'baseline' : 'personalized';

  let needs;
  let contents;
  let startingPath = null;
  if (mode === 'cold-start') {
    ({ needs, contents, startingPath } = await buildColdStart(profile, user));
  } else {
    needs = detectNeeds(profile);
    contents = await retrieveContents(user.targetExam, needs);
    for (let hop = 0; hop < 2; hop += 1) {
      const extra = derivePrerequisiteNeeds({ contents, needs, profile });
      if (!extra.length) break;
      needs = [...needs, ...extra];
      const known = new Set(contents.map((c) => String(c._id)));
      // eslint-disable-next-line no-await-in-loop
      const more = await retrieveContents(user.targetExam, extra);
      more.forEach((c) => {
        if (!known.has(String(c._id))) contents.push(c);
      });
    }
  }

  const ranked = rankContents({ contents, needs, profile }).filter((entry) => entry.score >= MIN_SCORE);
  const rankedById = new Map(ranked.map((entry) => [String(entry.content._id), entry]));

  // Needs with no eligible resource (no material, or all of it already completed) fall back
  // to a practice-only recommendation - honest about the gap instead of inventing content.
  const coveredTopics = new Set(ranked.map((e) => topicKey(e.need.subject, e.need.topic)));
  const gapTopics = new Set();
  const practiceEntries = [];
  [...needs]
    .sort((a, b) => b.urgency - a.urgency)
    .forEach((need) => {
      const key = topicKey(need.subject, need.topic);
      if (!PRACTICE_GAP_TYPES.includes(need.type) || coveredTopics.has(key) || gapTopics.has(key)) return;
      if (practiceEntries.length >= 8) return;
      gapTopics.add(key);
      practiceEntries.push({ kind: 'practice', need });
    });

  const all = [
    ...ranked.map((entry) => ({ kind: 'content', need: entry.need, score: entry.score, entry })),
    ...practiceEntries.map((entry) => ({ kind: 'practice', need: entry.need, score: scorePracticeOnly({ need: entry.need, profile }).score, entry })),
  ].sort((a, b) => b.score - a.score || b.need.urgency - a.need.urgency);

  const toPre = (candidate) =>
    candidate.kind === 'content' ? contentPre(candidate.entry, profile, now) : practicePre(candidate.entry.need, profile, now);
  const candKey = (c) => (c.kind === 'content' ? `c:${c.entry.content._id}` : `p:${topicKey(c.need.subject, c.need.topic)}`);

  // ---- allocate sections ----
  const used = new Set();
  const primaryCand = all[0] || null;
  if (primaryCand) used.add(candKey(primaryCand));

  const pickSection = (types, limit) => {
    const out = [];
    const topics = new Set();
    for (const cand of all) {
      if (out.length >= limit) break;
      if (used.has(candKey(cand)) || !types.includes(cand.need.type)) continue;
      const tk = topicKey(cand.need.subject, cand.need.topic);
      if (topics.has(tk)) continue;
      // The primary's learning path already covers its own topic for the same reason.
      if (primaryCand && tk === topicKey(primaryCand.need.subject, primaryCand.need.topic) && cand.need.type === primaryCand.need.type) continue;
      topics.add(tk);
      used.add(candKey(cand));
      out.push(cand);
    }
    return out;
  };

  const sectionCands = {};
  Object.keys(SECTION_TYPES).forEach((name) => {
    sectionCands[name] = pickSection(SECTION_TYPES[name], SECTION_LIMITS[name]);
  });

  const alsoCands = [];
  if (primaryCand) {
    const topics = new Set([topicKey(primaryCand.need.subject, primaryCand.need.topic)]);
    for (const cand of all) {
      if (alsoCands.length >= 2) break;
      const tk = topicKey(cand.need.subject, cand.need.topic);
      if (used.has(candKey(cand)) || topics.has(tk)) continue;
      topics.add(tk);
      used.add(candKey(cand));
      alsoCands.push(cand);
    }
  }

  // ---- primary + learning path ----
  const primaryPre = primaryCand ? toPre(primaryCand) : null;
  let pathSteps = [];
  const pathPre = new Map();
  if (primaryPre) {
    const need = primaryCand.need;
    const topicContents = contents.filter((c) => c.subject === need.subject && norm(c.topic) === norm(need.topic));
    pathSteps = buildPath({
      need,
      level: need.level,
      topicContents,
      rankedById,
      profile,
      primary: primaryCand.kind === 'content' ? primaryCand.entry.content : null,
    });
    pathSteps
      .filter((s) => s.kind === 'content' && s.status !== 'completed')
      .forEach((step) => {
        const content = topicContents.find((c) => String(c._id) === step.contentId);
        if (!content) return;
        const entry = rankedById.get(step.contentId) || { content, need, ...scoreContent({ content, need, profile }) };
        pathPre.set(step.contentId, contentPre({ ...entry, need: entry.need || need }, profile, now));
      });
  }

  const weakPre = sectionCands.weakAreas.map(toPre);
  const otherWeakPre = weakPre.find((p) => !primaryPre || p.target.topic !== primaryPre.target.topic) || null;

  // ---- persist exactly what will be shown ----
  const toPersist = new Map();
  const add = (pre) => pre && toPersist.set(pre.dedupeKey, pre);
  const sectionPre = {
    weakAreas: weakPre,
    mistakeRecovery: sectionCands.mistakeRecovery.map(toPre),
    challenges: sectionCands.challenges.map(toPre),
    exploreNew: sectionCands.exploreNew.map(toPre),
    alsoConsider: alsoCands.map(toPre),
  };
  if (requested.has('learnNext') || requested.has('dailyPlan')) {
    add(primaryPre);
    pathPre.forEach(add);
  }
  if (requested.has('learnNext')) sectionPre.alsoConsider.forEach(add);
  ['weakAreas', 'mistakeRecovery', 'challenges', 'exploreNew'].forEach((name) => {
    if (requested.has(name)) sectionPre[name].forEach(add);
  });
  if (requested.has('dailyPlan')) add(otherWeakPre);

  const docs = await recordServed(user._id, Array.from(toPersist.values()), now);

  const finalize = (pre, section) => {
    if (!pre) return null;
    const doc = docs.get(pre.dedupeKey);
    const id = doc ? String(doc._id) : null;
    const item = {
      id,
      kind: pre.kind,
      section,
      content: serializeContent(pre.content),
      target: pre.target,
      recommendationReason: pre.recommendationReason,
      reason: pre.reason,
      reasonSource: 'rules',
      priority: pre.priority,
      score: pre.score,
      stage: pre.stage,
      contentGap: pre.contentGap,
      signals: pre.signals,
      status: doc?.status || 'active',
      progress: pre.contentId ? serializeProgress(profile.progressByContent.get(pre.contentId)) : null,
      practice: {
        ...pre.practice,
        route: id ? `/practice?mode=content-practice&rec=${id}&count=${pre.practice.count}` : null,
      },
    };
    return item;
  };

  const bundle = {
    source: 'learning-recommendation-engine',
    mode,
    dataConfidence: profile.dataConfidence,
    generatedAt: now,
    totalAttempts: profile.totalAttempts,
    baseline:
      mode === 'baseline'
        ? { attempts: profile.totalAttempts, needed: BASELINE_ATTEMPTS_NEEDED }
        : null,
    welcome:
      mode === 'cold-start'
        ? {
            title: 'Welcome to TutorMind',
            message: "Let's establish your learning baseline.",
            baselineRoute: '/practice?mode=recommended',
          }
        : null,
    sectionMeta: SECTION_META,
    sections: {},
  };

  let primary = null;
  if (requested.has('learnNext') || requested.has('dailyPlan')) {
    primary = finalize(primaryPre, 'learnNext');
    if (primary) {
      primary.path = pathSteps.map((step) => ({
        ...step,
        recommendationId: step.contentId ? (docs.get(`c:${step.contentId}`) ? String(docs.get(`c:${step.contentId}`)._id) : null) : primary.id,
      }));
    }
  }
  if (requested.has('learnNext')) {
    bundle.learnNext = primary
      ? { primary, alsoConsider: sectionPre.alsoConsider.map((p) => finalize(p, 'learnNext')) }
      : null;
    if (!primary) {
      bundle.emptyState = {
        title: 'You are all caught up',
        message: 'No learning need stands out right now. Keep practicing to unlock sharper recommendations.',
      };
    }
  }
  ['weakAreas', 'mistakeRecovery', 'challenges', 'exploreNew'].forEach((name) => {
    if (requested.has(name)) bundle.sections[name] = sectionPre[name].map((p) => finalize(p, name));
  });
  if (startingPath) {
    bundle.startingPath = startingPath.map((row) => ({
      ...row,
      recommendationId:
        [primary, ...(bundle.sections.exploreNew || [])].filter(Boolean).find((it) => it.target.topic === row.topic && it.target.subject === row.subject)?.id || null,
    }));
  }

  // ---- daily plan ----
  if (requested.has('dailyPlan')) {
    const pathItems = new Map();
    pathPre.forEach((pre, contentId) => pathItems.set(contentId, finalize(pre, 'dailyPlan')));
    const weakItem = otherWeakPre ? finalize(otherWeakPre, 'dailyPlan') : null;
    let dueMistakes = 0;
    profile.topics.forEach((t) => {
      dueMistakes += t.dueMistakes || 0;
    });
    bundle.dailyPlan = buildDailyPlan({
      primary,
      pathItems,
      weakItems: weakItem ? [weakItem] : [],
      dueMistakes,
      budgetMinutes: options.minutes || undefined,
    });
    if (!bundle.dailyPlan.items.length) {
      bundle.dailyPlan.items.push({
        order: 1,
        type: 'practice',
        title: 'Solve a recommended practice set',
        stage: 'practice',
        minutes: 15,
        subject: null,
        topic: null,
        reason: 'A balanced set chosen from your recent performance.',
        recommendationReason: 'fallback',
        recommendationId: null,
        route: '/practice?mode=recommended',
      });
      bundle.dailyPlan.totalMinutes = 15;
    }
  }

  // ---- continue learning / practice after learning / improvements ----
  if (requested.has('continueLearning')) {
    const inProgress = Array.from(profile.progressByContent.values())
      .filter((p) => p.status === 'in-progress')
      .sort((a, b) => new Date(b.lastAccessedAt || 0) - new Date(a.lastAccessedAt || 0))
      .slice(0, 5);
    const ids = inProgress.map((p) => p.content);
    const [items, recs] = ids.length
      ? await Promise.all([
          LearningContent.find({ _id: { $in: ids }, isActive: true }).select('-body').lean(),
          LearningRecommendation.find({ user: user._id, open: true, status: 'started', content: { $in: ids } }).lean(),
        ])
      : [[], []];
    const contentById = new Map(items.map((c) => [String(c._id), c]));
    const recByContent = new Map(recs.map((r) => [String(r.content), r]));
    bundle.sections.continueLearning = inProgress
      .map((p) => {
        const content = contentById.get(String(p.content));
        const rec = recByContent.get(String(p.content));
        if (!content || !rec) return null;
        return {
          id: String(rec._id),
          kind: 'content',
          section: 'continueLearning',
          content: serializeContent(content),
          target: rec.target,
          recommendationReason: rec.recommendationReason,
          reason: `You are ${p.progressPercent}% of the way through this ${content.contentType}. Pick up where you left off.`,
          reasonSource: 'rules',
          priority: 'high',
          score: rec.score,
          stage: content.learningStage,
          contentGap: false,
          signals: rec.signals || {},
          status: rec.status,
          progress: serializeProgress(p),
          practice: { count: DEFAULT_PRACTICE_COUNT, difficulty: null, route: `/practice?mode=content-practice&rec=${rec._id}&count=${DEFAULT_PRACTICE_COUNT}` },
        };
      })
      .filter(Boolean)
      // when the resource is already the Learn Next hero (which shows its progress), don't repeat it
      .filter((item) => !primary || item.id !== primary.id)
      .slice(0, 3);
  }

  if (requested.has('practiceAfterLearning') || requested.has('improvements')) {
    const completed = await LearningRecommendation.find({
      user: user._id,
      status: 'completed',
      completedAt: { $gte: new Date(now.getTime() - 30 * DAY_MS) },
    })
      .sort({ completedAt: -1 })
      .limit(5)
      .lean();
    const contentRows = completed.length
      ? await LearningContent.find({ _id: { $in: completed.filter((r) => r.content).map((r) => r.content) } })
          .select('-body')
          .lean()
      : [];
    const contentById = new Map(contentRows.map((c) => [String(c._id), c]));
    const evaluations = await Promise.all(completed.map((rec) => evaluateEffectiveness(rec, { now })));

    bundle.sections.practiceAfterLearning = [];
    bundle.improvements = [];
    completed.forEach((rec, i) => {
      const evaluation = evaluations[i];
      const content = contentById.get(String(rec.content));
      const title = content?.title || rec.target.topic;
      if (evaluation.available) {
        bundle.improvements.push({ recommendationId: String(rec._id), title, target: rec.target, effectiveness: evaluation });
      }
      const recent = new Date(rec.completedAt) >= new Date(now.getTime() - 7 * DAY_MS);
      const answered = evaluation.practiceAttemptsAfter || 0;
      if (recent && answered < DEFAULT_PRACTICE_COUNT && content && content.isActive && bundle.sections.practiceAfterLearning.length < 3) {
        bundle.sections.practiceAfterLearning.push({
          id: String(rec._id),
          kind: 'content',
          section: 'practiceAfterLearning',
          content: serializeContent(content),
          target: rec.target,
          recommendationReason: rec.recommendationReason,
          reason: `You completed "${title}"${answered ? ` and have answered ${answered} of ${DEFAULT_PRACTICE_COUNT} practice questions since` : ''}. Test your understanding now.`,
          reasonSource: 'rules',
          priority: 'medium',
          score: rec.score,
          stage: 'practice',
          contentGap: false,
          signals: rec.signals || {},
          status: rec.status,
          progress: { status: 'completed', progressPercent: 100 },
          practice: { count: DEFAULT_PRACTICE_COUNT, difficulty: null, route: `/practice?mode=content-practice&rec=${rec._id}&count=${DEFAULT_PRACTICE_COUNT}` },
        });
      }
    });
    if (!requested.has('improvements')) delete bundle.improvements;
    if (!requested.has('practiceAfterLearning')) delete bundle.sections.practiceAfterLearning;
  }

  // ---- optional AI polish of the single top explanation (never required, never blocking) ----
  if (primary && requested.has('learnNext') && (aiEnabled() || options.aiExplainer)) {
    try {
      const polish = options.aiExplainer || polishExplanation;
      const better = await polish(primary.reason);
      if (better && typeof better === 'string') {
        primary.reason = better;
        primary.reasonSource = 'ai-polished';
      }
    } catch (error) {
      // keep the rule-based explanation
    }
  }

  return bundle;
};

module.exports = { getLearningBundle, SECTION_KEYS, SECTION_META, retrieveContents };