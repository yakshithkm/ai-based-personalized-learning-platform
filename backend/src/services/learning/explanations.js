const { STAGE_LABELS, WEAK_ACCURACY_THRESHOLD } = require('./constants');

// Every sentence is assembled from concrete numbers in `need.signals` (accuracy, attempts,
// mistakes, days since practice, ...). Nothing is generic "AI thinks this is good" filler,
// and the wording never claims a finer granularity (concept vs topic) than the data has.
// Each need type yields a measurable `fact` and a stage-dependent `action`.

const stageText = (stage) => STAGE_LABELS[stage] || 'study material';
const n = (value) => Math.round(Number(value || 0));

const timeClause = (s) => (s.avgTimeSec >= 75 ? ` and you average ${n(s.avgTimeSec)}s per question` : '');

// If the data is concept-level but the resource is only topic-level, say "in <topic>".
const scopeOf = (need, matchLevel) =>
  need.granularity === 'concept' && need.concept && matchLevel === 'concept' ? need.concept : need.topic;

const parts = (need, matchLevel) => {
  const s = need.signals || {};
  const scope = scopeOf(need, matchLevel);

  switch (need.type) {
    case 'weak-topic':
      return {
        fact: `Your accuracy in ${need.topic} is ${n(s.accuracy)}% across ${s.attempts} attempts${timeClause(s)}, below the ${WEAK_ACCURACY_THRESHOLD}% target.`,
        action: (stage) => `This ${stageText(stage)} is prioritized before more problems.`,
      };
    case 'weak-concept':
      return {
        fact:
          `Your accuracy in ${scope} is ${n(s.accuracy)}% across ${s.attempts} attempts` +
          `${s.mistakeFrequency ? ` with a ${n(s.mistakeFrequency)}% mistake rate` : ''}${timeClause(s)}.`,
        action: (stage) => `This ${stageText(stage)} targets that concept.`,
      };
    case 'mistake-recovery':
      return {
        fact:
          `You have ${s.openMistakes} unresolved mistake${s.openMistakes === 1 ? '' : 's'} in ${scope}` +
          `${s.attempts ? ` (accuracy ${n(s.accuracy)}% over ${s.attempts} attempts)` : ''}.`,
        action: (stage) => `This ${stageText(stage)} covers the idea behind those errors before you retry them.`,
      };
    case 'spaced-review':
      return {
        fact: `${s.dueMistakes} mistake review${s.dueMistakes === 1 ? ' is' : 's are'} due in ${need.topic} now.`,
        action: (stage) => `A quick ${stageText(stage)} refreshes the concept before you retry them.`,
      };
    case 'prerequisite':
      return {
        fact: need.dependent
          ? `${need.dependent.topic} builds on ${need.topic}, where your accuracy is ${n(s.accuracy)}% across ${s.attempts} attempts.`
          : `Your accuracy in ${need.topic} is ${n(s.accuracy)}% across ${s.attempts} attempts, and later topics build on it.`,
        action: (stage) => `Strengthen this foundation first with this ${stageText(stage)}.`,
      };
    case 'new-topic':
      return {
        fact: `You have not practiced ${need.topic} yet${need.weightage ? ` (${need.weightage.toLowerCase()} exam weightage)` : ''}.`,
        action: () => 'An introduction comes before difficult questions.',
      };
    case 'mastery-progression':
      return {
        fact: `You are at ${n(s.accuracy)}% accuracy in ${need.topic} over ${s.attempts} attempts (mastery ${n(s.mastery)}/100).`,
        action: (stage) => `The next step up is this ${stageText(stage)}.`,
      };
    case 'advanced-challenge':
      return {
        fact: `You ${s.trend === 'declining' ? 'reached' : 'have maintained'} ${n(s.accuracy)}% accuracy in ${need.topic} over ${s.attempts} attempts (mastery ${n(s.mastery)}/100).`,
        action: () => 'Move on to advanced application problems.',
      };
    case 'stagnation-break':
      return {
        fact: `Your accuracy in ${need.topic} has stayed around ${n(s.accuracy)}% across ${s.attempts} attempts.`,
        action: (stage) => `A different angle - this ${stageText(stage)} - is likelier to help than more of the same practice.`,
      };
    case 'revision':
      return {
        fact: `You have not practiced ${need.topic} for ${s.daysSincePractice} days (accuracy ${n(s.accuracy)}%).`,
        action: (stage) => `A quick ${stageText(stage)} keeps it fresh.`,
      };
    case 'exam-preparation':
      return {
        fact:
          `${need.topic} is a high-weightage topic${need.pyqShare ? ` (${n(need.pyqShare * 100)}% of its questions are previous-year)` : ''} ` +
          `and your accuracy there is ${n(s.accuracy)}% over ${s.attempts} attempts.`,
        action: (stage) => `This ${stageText(stage)} is aimed at exam-style problems.`,
      };
    case 'cold-start':
      return {
        fact:
          `A starting point for your preparation: ${need.subject} - ${need.topic}` +
          `${need.weightage ? ` (${need.weightage.toLowerCase()} exam weightage)` : ''}. You have no practice history yet.`,
        action: () => 'This introduction comes before any difficult questions.',
      };
    default:
      return {
        fact: `Selected to keep your ${need.subject} coverage balanced.`,
        action: () => '',
      };
  }
};

const buildContentExplanation = ({ need, content, matchLevel }) => {
  const { fact, action } = parts(need, matchLevel);
  return `${fact} ${action(content?.learningStage)}`.trim();
};

// Practice-only recommendation (no study material exists for the target yet).
const buildPracticeExplanation = ({ need, difficulty }) => {
  const { fact } = parts(need, 'topic');
  return `${fact} We do not have study material for ${need.topic} yet, so start with targeted ${difficulty || 'Medium'} practice.`;
};

module.exports = { buildContentExplanation, buildPracticeExplanation, stageText };