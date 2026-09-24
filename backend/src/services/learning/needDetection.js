const {
  WEAK_ACCURACY_THRESHOLD,
} = require('./constants');
const {
  confidence,
  isPseudoTopic,
  norm,
  topicKey,
  resolveNamedStat,
} = require('./learnerProfile');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round1 = (value) => Number(Number(value || 0).toFixed(1));

const signalsFromStat = (stat) => ({
  accuracy: round1(stat.accuracy),
  attempts: stat.attempts,
  mastery: round1(stat.mastery),
  recentAccuracy: stat.recentAccuracy ?? null,
  historicalAccuracy: stat.historicalAccuracy ?? null,
  trend: stat.trend || 'stable',
  avgTimeSec: Math.round(stat.avgTime || 0),
  openMistakes: stat.openMistakes || 0,
  dueMistakes: stat.dueMistakes || 0,
  slowCorrectRate: round1(stat.slowCorrectRate),
  fastWrongRate: round1(stat.fastWrongRate),
  daysSincePractice: stat.daysSincePractice ?? null,
  level: stat.level,
});

const makeNeed = ({
  type,
  subject,
  topic,
  subtopic = 'General',
  concept = '',
  granularity = 'topic',
  urgency,
  level,
  signals = {},
  extra = {},
}) => ({
  key: `${type}:${subject}::${norm(topic)}::${norm(concept)}`,
  type,
  subject,
  topic,
  subtopic,
  concept,
  granularity,
  urgency: Number(clamp(urgency, 0, 1).toFixed(3)),
  level,
  signals,
  ...extra,
});

const isDefaultConcept = (stat) =>
  norm(stat.concept) === norm(stat.topic) || /core concept$/i.test(stat.concept || '');

/**
 * Turns a learner profile into a list of "learning needs" - the *why* behind every
 * recommendation. Weak-topic / weak-concept / mistake thresholds intentionally reuse the
 * existing analysis rules (accuracy < 60, concept accuracy < 70, mistakeFrequency > 35,
 * slowCorrectRate > 30) so the content engine agrees with the question engine and analytics.
 */
const detectNeeds = (profile) => {
  const needs = [];

  // --- concept-level (only concepts that are genuinely finer than the topic) ---
  const conceptMistakeTopics = new Set();
  profile.concepts.forEach((stat) => {
    if (isDefaultConcept(stat)) return;
    const conf = confidence(stat.attempts);
    const base = {
      subject: stat.subject,
      topic: stat.topic,
      concept: stat.concept,
      granularity: 'concept',
      level: stat.level,
      signals: { ...signalsFromStat(stat), mistakeFrequency: round1(stat.mistakeFrequency), scope: 'concept' },
    };

    const repeatedMistakes = stat.openMistakes >= 2 || (stat.openMistakes >= 1 && stat.accuracy < WEAK_ACCURACY_THRESHOLD);
    if (repeatedMistakes) {
      conceptMistakeTopics.add(topicKey(stat.subject, stat.topic));
      needs.push(makeNeed({ ...base, type: 'mistake-recovery', urgency: 0.3 + 0.14 * stat.openMistakes }));
    }

    if (stat.attempts >= 3 && (stat.accuracy < 70 || stat.mistakeFrequency > 35 || stat.slowCorrectRate > 30)) {
      const priorityScore =
        (100 - stat.accuracy) * 0.45 + stat.mistakeFrequency * 0.35 + stat.slowCorrectRate * 0.2;
      needs.push(makeNeed({ ...base, type: 'weak-concept', urgency: (priorityScore / 100) * conf }));
    }
  });

  // --- topic-level ---
  const practiced = new Set();
  profile.topics.forEach((stat, key) => {
    practiced.add(key);
    if (isPseudoTopic(stat.topic)) return;
    const conf = confidence(stat.attempts);
    const signals = signalsFromStat(stat);
    const base = { subject: stat.subject, topic: stat.topic, level: stat.level, signals };
    const catalog = profile.syllabus.find((s) => s.subject === stat.subject && norm(s.topic) === norm(stat.topic));

    // weak-topic (existing rule: accuracy < 60)
    if (stat.attempts >= 1 && stat.accuracy < WEAK_ACCURACY_THRESHOLD) {
      let urgency = (stat.focusScore / 100) * conf;
      if (stat.accuracy < 50 && stat.attempts >= 5) urgency = Math.max(urgency, 0.35);
      needs.push(makeNeed({ ...base, type: 'weak-topic', urgency }));
    }

    // repeated mistakes on the topic itself (not already covered by a finer concept)
    if (
      !conceptMistakeTopics.has(topicKey(stat.subject, stat.topic)) &&
      (stat.openMistakes >= 2 || (stat.openMistakes >= 1 && stat.accuracy < WEAK_ACCURACY_THRESHOLD))
    ) {
      needs.push(makeNeed({ ...base, type: 'mistake-recovery', urgency: 0.3 + 0.14 * stat.openMistakes }));
    }

    // spaced repetition: mistake reviews that are due now
    if (stat.dueMistakes >= 1) {
      needs.push(makeNeed({ ...base, type: 'spaced-review', urgency: 0.4 + 0.12 * stat.dueMistakes }));
    }

    // stagnation: lots of practice, middling accuracy, no movement
    const drift =
      stat.recentAccuracy !== null && stat.historicalAccuracy !== null
        ? Math.abs(stat.recentAccuracy - stat.historicalAccuracy)
        : null;
    if (
      stat.attempts >= 12 &&
      stat.accuracy >= 40 &&
      stat.accuracy <= 75 &&
      drift !== null &&
      drift < 4
    ) {
      needs.push(makeNeed({ ...base, type: 'stagnation-break', urgency: 0.55 }));
    }

    // steady progression through the 60-80 band
    if (stat.attempts >= 5 && stat.accuracy >= WEAK_ACCURACY_THRESHOLD && stat.accuracy < 80 && ['developing', 'proficient'].includes(stat.level)) {
      needs.push(makeNeed({ ...base, type: 'mastery-progression', urgency: 0.4 }));
    }

    // mastered: push to advanced application
    if (stat.level === 'high') {
      needs.push(
        makeNeed({ ...base, type: 'advanced-challenge', urgency: stat.trend === 'declining' ? 0.4 : 0.55 })
      );
    }

    // revision of a topic that has gone cold
    if (['proficient', 'high'].includes(stat.level) && stat.daysSincePractice !== null && stat.daysSincePractice >= 14) {
      needs.push(
        makeNeed({ ...base, type: 'revision', urgency: Math.min(1, stat.daysSincePractice / 45) * 0.6 })
      );
    }

    // exam-weighted topics that are not yet mastered
    if (
      catalog &&
      catalog.weightage === 'High' &&
      stat.attempts >= 5 &&
      ['developing', 'proficient', 'high'].includes(stat.level) &&
      stat.accuracy < 90
    ) {
      needs.push(
        makeNeed({
          ...base,
          type: 'exam-preparation',
          urgency: 0.45,
          extra: { weightage: catalog.weightage, pyqShare: catalog.pyqShare },
        })
      );
    }
  });

  // --- new (never practiced) syllabus topics ---
  const subjectAttempts = new Map(profile.subjectStats.map((s) => [s.subject, s.attempts]));
  const minSubjectAttempts = Math.min(
    ...profile.syllabus.map((s) => subjectAttempts.get(s.subject) || 0),
    Infinity
  );
  const newNeeds = profile.syllabus
    .filter((s) => !isPseudoTopic(s.topic) && !practiced.has(topicKey(s.subject, s.topic)))
    .map((s) => {
      const base = s.weightage === 'High' ? 0.5 : s.weightage === 'Medium' ? 0.4 : 0.3;
      const neglected = (subjectAttempts.get(s.subject) || 0) === minSubjectAttempts ? 0.1 : 0;
      return makeNeed({
        type: 'new-topic',
        subject: s.subject,
        topic: s.topic,
        level: 'new',
        urgency: base + neglected,
        signals: { attempts: 0, level: 'new', weightage: s.weightage, questions: s.questions },
        extra: { weightage: s.weightage, pyqShare: s.pyqShare },
      });
    })
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 8);

  return [...needs, ...newNeeds].sort((a, b) => b.urgency - a.urgency).slice(0, 40);
};

/**
 * Prerequisite expansion (one hop per call): if a candidate resource for a needed topic lists
 * prerequisites and the student's level on one of them is 'low', that prerequisite becomes a
 * need of its own - so its content is recommended first.
 */
const derivePrerequisiteNeeds = ({ contents, needs, profile }) => {
  const existing = new Set(needs.map((n) => n.key));
  const out = [];
  const actionable = ['weak-topic', 'weak-concept', 'mistake-recovery', 'mastery-progression', 'spaced-review', 'prerequisite'];

  contents.forEach((content) => {
    if (!content.prerequisites?.length) return;
    const dependents = needs.filter(
      (n) => actionable.includes(n.type) && n.subject === content.subject && norm(n.topic) === norm(content.topic)
    );
    if (!dependents.length) return;
    const dependentUrgency = Math.max(...dependents.map((n) => n.urgency));

    content.prerequisites.forEach((name) => {
      const stat = resolveNamedStat(profile, content.subject, name);
      if (!stat || stat.level !== 'low') return;
      const isTopicStat = Object.prototype.hasOwnProperty.call(stat, 'daysSincePractice');
      const need = makeNeed({
        type: 'prerequisite',
        subject: content.subject,
        topic: stat.topic,
        concept: isTopicStat ? '' : stat.concept,
        granularity: isTopicStat ? 'topic' : 'concept',
        level: stat.level,
        urgency: Math.max(0.45, dependentUrgency),
        signals: signalsFromStat(stat),
        extra: {
          dependent: { topic: content.topic, title: content.title, accuracy: dependents[0].signals.accuracy ?? null },
          prerequisiteName: name,
        },
      });
      if (!existing.has(need.key)) {
        existing.add(need.key);
        out.push(need);
      }
    });
  });
  return out;
};

module.exports = { detectNeeds, derivePrerequisiteNeeds, signalsFromStat, makeNeed };