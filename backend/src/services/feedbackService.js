const buildConfidenceInsight = ({ isCorrect, timeTakenSec, expectedTimeSec, selectedAnswerText }) => {
  const expected = Math.max(Number(expectedTimeSec || 60), 15);
  const actual = Math.max(Number(timeTakenSec || expected), 1);

  if (isCorrect && actual <= expected * 0.8) {
    return 'fast-correct';
  }

  if (isCorrect && actual > expected * 1.2) {
    return 'slow-correct';
  }

  if (!isCorrect && actual <= Math.max(12, expected * 0.4) && selectedAnswerText) {
    return 'likely-guess';
  }

  return isCorrect ? 'steady-correct' : 'uncertain';
};

let feedbackSequence = 0;

const hashString = (value = '') => {
  let hash = 0;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const pickVariant = (variants, key) => {
  if (!variants || !variants.length) return '';
  feedbackSequence += 1;
  const index = (hashString(key) + feedbackSequence) % variants.length;
  return variants[index];
};

const pickTone = ({ mistakeType, repeatedMistakeCount, confidenceInsight }) => {
  if (mistakeType === 'Concept Error' && Number(repeatedMistakeCount || 0) >= 2) {
    return 'warning';
  }
  if (confidenceInsight === 'slow-correct') {
    return 'analytical';
  }
  if (mistakeType === 'Careless Mistake') {
    return 'coaching';
  }
  return 'analytical';
};

const buildDynamicPrefix = ({
  lane = 'analysis',
  topic = '',
  conceptTested = '',
  mistakeType = '',
  selectedAnswerText = '',
  responsePace = 'on-time',
  repeatedMistakeCount = 0,
  commonMistakePattern = '',
}) => {
  const prefixPools = {
    analysis: [
      'Observation:',
      'Diagnosis:',
      'Pattern Trace:',
      'Signal Review:',
      'Evidence Check:',
      'Performance Read:',
      'Model Insight:',
      'Error Profile:',
      'Reasoning Audit:',
      'Attempt Snapshot:',
    ],
    coaching: [
      'Coach Lens:',
      'Tutor Nudge:',
      'Guidance:',
      'Practice Cue:',
      'Next Move:',
      'Action Prompt:',
      'Study Move:',
      'Correction Path:',
      'Learning Cue:',
      'Drill Note:',
    ],
    warning: [
      'Alert:',
      'Warning:',
      'Risk Note:',
      'Priority Fix:',
      'Critical Pattern:',
      'Escalation Signal:',
      'Stability Risk:',
      'Urgent Correction:',
      'Intervention Needed:',
      'Reliability Alert:',
    ],
  };

  const key = `${lane}|${topic}|${conceptTested}|${mistakeType}|${selectedAnswerText}|${responsePace}|${repeatedMistakeCount}|${commonMistakePattern}`;
  return pickVariant(prefixPools[lane] || prefixPools.analysis, key);
};

const classifyMistake = ({
  isCorrect,
  timeTakenSec,
  expectedTimeSec,
  selectedAnswerText,
  repeatedMistakeCount,
  questionCommonMistake,
}) => {
  if (isCorrect) return '';

  const expected = Math.max(Number(expectedTimeSec || 60), 15);
  const actual = Math.max(Number(timeTakenSec || expected), 1);

  if (actual <= Math.max(12, expected * 0.4)) {
    return 'Careless Mistake';
  }

  if (repeatedMistakeCount >= 2) {
    return 'Concept Error';
  }

  if (/calculate|formula|arithmetic|sign/i.test(questionCommonMistake || '')) {
    return 'Calculation Error';
  }

  if (/\d/.test(selectedAnswerText || '')) {
    return 'Calculation Error';
  }

  return 'Concept Error';
};

const buildActionableFix = ({ mistakeType, conceptTested, topic, confidenceInsight }) => {
  if (mistakeType === 'Careless Mistake') {
    return `Before submitting in ${topic}, run a 10-second final check for units, sign, and option elimination.`;
  }

  if (mistakeType === 'Calculation Error') {
    return `Re-solve one ${conceptTested} problem slowly and write each algebraic step to prevent arithmetic slips.`;
  }

  if (confidenceInsight === 'slow-correct') {
    return `You got ${conceptTested} right but slowly. Practice 3 timed drills to reduce solving latency.`;
  }

  return `Revise ${conceptTested} from first principles, then solve two mixed questions in ${topic}.`;
};

const buildImprovementTip = ({
  isCorrect,
  timeTakenSec,
  topic,
  difficulty,
  selectedAnswerText,
  conceptTested,
  expectedTimeSec,
  mistakeType,
  repeatedMistakeCount = 0,
  responsePace = 'on-time',
}) => {
  const confidenceInsight = buildConfidenceInsight({
    isCorrect,
    timeTakenSec,
    expectedTimeSec,
    selectedAnswerText,
  });

  const tone = pickTone({
    mistakeType,
    repeatedMistakeCount,
    confidenceInsight,
  });

  if (confidenceInsight === 'fast-correct') {
    return pickVariant(
      [
        `Excellent control in ${conceptTested}. Try one harder ${difficulty} question to stretch mastery.`,
        `You solved ${conceptTested} quickly and correctly. Move to one tougher variant to deepen transfer.`,
        `Great speed and accuracy in ${conceptTested}. Take a higher-difficulty question to avoid plateauing.`,
      ],
      `${topic}-${conceptTested}-${mistakeType || 'none'}-fast-correct`
    );
  }

  if (confidenceInsight === 'slow-correct') {
    return pickVariant(
      [
        `Correct in ${topic}, but slower than expected. Solve 3 timed ${conceptTested} questions.`,
        `Accuracy is solid, but pacing slipped on ${conceptTested}. Run short timed drills to cut latency.`,
        `You reached the right answer in ${topic} with extra time. Practice clocked reps to improve execution speed.`,
      ],
      `${topic}-${conceptTested}-${mistakeType || 'none'}-slow-correct`
    );
  }

  if (!isCorrect) {
    if (mistakeType === 'Careless Mistake') {
      const layers = {
        analytical: [
          `Response pace was ${responsePace}; that profile often creates avoidable slips in ${topic}. Add a mandatory verification step before committing.`,
          `Your recent timing pattern indicates rushed decisions in ${topic}. Inject a 10-second check to reduce low-quality errors.`,
          `Observed pattern: decision latency is too short for ${topic}. A brief validation checkpoint should be non-negotiable.`,
          `Data signal shows haste-driven misses in ${topic}; apply a pre-submit checklist before locking answers.`,
        ],
        coaching: [
          `Pause before submit: in ${topic}, quickly re-check sign, unit, and elimination logic to catch careless misses.`,
          `Small habit change: take one breath, scan options once, then lock your answer in ${topic}.`,
          `Try this routine in ${topic}: read the stem once more, eliminate one wrong option, then confirm your final pick.`,
          `Use a micro-reset in ${topic}: 5 seconds for a final logic scan can prevent most avoidable slips.`,
        ],
        warning: [
          `This careless pattern is repeating. If you keep rushing in ${topic}, accuracy will remain unstable despite practice volume.`,
          `You are leaking marks through avoidable slips in ${topic}; slow down the final selection step immediately.`,
          `Warning: repeated rushed choices in ${topic} are now a systemic issue, not isolated mistakes.`,
          `At this pace, careless misses in ${topic} will continue to erase gains from correct reasoning.`,
        ],
      };
      return pickVariant(layers[tone], `${topic}-${conceptTested}-${selectedAnswerText}-careless-${tone}`);
    }

    if (mistakeType === 'Calculation Error') {
      const layers = {
        analytical: [
          `This is an execution-layer failure in ${conceptTested}. Keep explicit intermediate steps and validate each transition.`,
          `Error source is computational drift in ${conceptTested}; enforce a strict stepwise workflow before answer selection.`,
          `Computation integrity broke in ${conceptTested}; reintroduce line-by-line verification for each transformation.`,
          `Pattern analysis points to arithmetic transition errors in ${conceptTested}; structured derivation is required.`,
        ],
        coaching: [
          `Work line-by-line: write every step in ${conceptTested}, then re-check arithmetic/signs once before selecting.`,
          `Treat this as a mechanics drill. In ${conceptTested}, slow one level down and verify each line.`,
          `Run a two-pass solve in ${conceptTested}: first for structure, second for arithmetic accuracy.`,
          `In ${conceptTested}, speak each transformation step mentally before writing the next one.`,
        ],
        warning: [
          `Calculation slips are becoming a pattern in ${conceptTested}. Without disciplined step tracking, speed gains will be meaningless.`,
          `You are dropping marks on execution, not knowledge. Lock in process discipline for ${conceptTested} now.`,
          `Repeated execution errors in ${conceptTested} are now critical; uncontrolled arithmetic is blocking progress.`,
          `If calculation discipline is not fixed in ${conceptTested}, higher-difficulty practice will not convert to scores.`,
        ],
      };
      return pickVariant(layers[tone], `${topic}-${conceptTested}-${selectedAnswerText}-calculation-${tone}`);
    }

    const layers = {
      analytical: [
        `Diagnosis: principle mismatch in ${conceptTested}. Re-derive the governing rule and test it on two nearby variants.`,
        `The error is conceptual, not random. Reconstruct the logic chain for ${conceptTested} before attempting mixed questions again.`,
        `Your answer pattern indicates rule-level confusion in ${conceptTested}; fix the underlying principle before speed work.`,
        `This miss is caused by concept selection, not computation. Re-anchor ${conceptTested} with first-principles reasoning.`,
      ],
      coaching: [
        `Rebuild ${conceptTested} from fundamentals, then solve one guided and one unguided question to verify transfer.`,
        `Say the core rule aloud for ${conceptTested}, then apply it to a fresh problem before returning to timed mode.`,
        `Start with a worked example in ${conceptTested}, then solve a near-variation to confirm the principle is stable.`,
        `Use teach-back method: explain ${conceptTested} in one paragraph, then attempt a new question without notes.`,
      ],
      warning: [
        `You've missed this exact concept repeatedly. Until ${conceptTested} is rebuilt, confidence will keep outrunning correctness.`,
        `Repeated concept error detected in ${conceptTested}. Pause progression and repair first-principles understanding now.`,
        `You are consistently confident but incorrect in ${conceptTested}; continuing forward now will reinforce the wrong model.`,
        `Escalating difficulty before fixing ${conceptTested} will amplify error patterns, not mastery.`,
      ],
    };
    return pickVariant(layers[tone], `${topic}-${conceptTested}-${selectedAnswerText}-concept-${tone}`);
  }

  return pickVariant(
    [
      `Good progress in ${topic}. Keep solving mixed questions to stabilize performance.`,
      `Your recent work in ${topic} is trending positive. Continue with mixed-difficulty practice to retain gains.`,
      `Steady improvement detected in ${topic}. Use spaced mixed practice to keep the concept durable.`,
    ],
    `${topic}-${conceptTested}-${mistakeType || 'none'}-steady`
  );
};

const buildWhyGotWrong = ({
  isCorrect,
  topic,
  conceptTested,
  commonMistakePattern,
  selectedAnswerText,
  mistakeType,
  repeatedMistakeCount = 0,
  responsePace = 'on-time',
}) => {
  if (isCorrect) {
    return '';
  }

  const tone = pickTone({
    mistakeType,
    repeatedMistakeCount,
    confidenceInsight: responsePace === 'slow' ? 'slow-correct' : 'uncertain',
  });

  if (commonMistakePattern) {
    if (mistakeType === 'Concept Error') {
      const layers = {
        analytical: [
          `Analysis: the observed miss indicates a principle-level mismatch in ${conceptTested}. Context: ${commonMistakePattern}`,
          `Diagnosis says this is a structural misconception in ${conceptTested}, not a random execution error. Context: ${commonMistakePattern}`,
          `Evidence suggests you are selecting the wrong governing principle in ${conceptTested}. Pattern note: ${commonMistakePattern}`,
          `Observed profile is conceptual: ${conceptTested} is being applied with an incorrect rule frame. Pattern note: ${commonMistakePattern}`,
        ],
        coaching: [
          `Coach note: you are applying the wrong idea in ${conceptTested}; reset the rule before retrying. Pattern: ${commonMistakePattern}`,
          `Let us repair the core principle in ${conceptTested} first, then return to speed. Pattern: ${commonMistakePattern}`,
          `Action step: revisit the exact principle for ${conceptTested}, then test it on one closely related problem. Signal: ${commonMistakePattern}`,
          `Next move is conceptual mapping for ${conceptTested} before another timed attempt. Signal: ${commonMistakePattern}`,
        ],
        warning: [
          `Warning: you've missed this exact concept ${Number(repeatedMistakeCount || 0)} times now, so the principle is still wrong. Signal: ${commonMistakePattern}`,
          `Critical warning: repeated conceptual failure in ${conceptTested} detected; continuing without rebuild will reinforce errors. Signal: ${commonMistakePattern}`,
          `Alert: persistent misconception in ${conceptTested} is now confirmed by repeated outcomes. Pattern: ${commonMistakePattern}`,
          `This is no longer an isolated miss; ${conceptTested} needs immediate conceptual correction. Pattern: ${commonMistakePattern}`,
        ],
      };
      const message = pickVariant(
        layers[tone],
        `${topic}-${conceptTested}-${selectedAnswerText}-why-concept-${tone}`
      );
      const prefix = buildDynamicPrefix({
        lane: tone === 'warning' ? 'warning' : tone === 'coaching' ? 'coaching' : 'analysis',
        topic,
        conceptTested,
        mistakeType,
        selectedAnswerText,
        responsePace,
        repeatedMistakeCount,
        commonMistakePattern,
      });
      return `${prefix} ${message}`;
    }

    if (mistakeType === 'Calculation Error') {
      const layers = {
        analytical: [
          `Analysis: computation pipeline broke in ${conceptTested}, most likely during intermediate transformation. Pattern: ${commonMistakePattern}`,
          `Data view: miss profile matches arithmetic/algebraic drift in ${conceptTested}. Pattern: ${commonMistakePattern}`,
          `Observed breakdown occurred in step execution for ${conceptTested}; logic path is fine but arithmetic control failed. Context: ${commonMistakePattern}`,
          `Intermediate transformation accuracy is unstable in ${conceptTested}. Context: ${commonMistakePattern}`,
        ],
        coaching: [
          `Coach note: you likely made a step execution slip in ${conceptTested}; slow and verify line-by-line. Pattern: ${commonMistakePattern}`,
          `This is fixable with process discipline: structure each calculation step for ${conceptTested}. Pattern: ${commonMistakePattern}`,
          `Try writing one extra intermediate line in ${conceptTested} to prevent hidden arithmetic jumps. Signal: ${commonMistakePattern}`,
          `Re-run the solve at half speed and validate each numeric transition in ${conceptTested}. Signal: ${commonMistakePattern}`,
        ],
        warning: [
          `Warning: repeated execution errors are undermining ${conceptTested}; tighten your process immediately. Pattern: ${commonMistakePattern}`,
          `Critical signal: calculation reliability is currently unstable in ${conceptTested}. Pattern: ${commonMistakePattern}`,
          `Execution quality in ${conceptTested} is now a persistent risk factor for score drop. Pattern: ${commonMistakePattern}`,
          `Unchecked arithmetic drift in ${conceptTested} will keep causing avoidable losses. Pattern: ${commonMistakePattern}`,
        ],
      };
      const message = pickVariant(
        layers[tone],
        `${topic}-${conceptTested}-${selectedAnswerText}-why-calc-${tone}`
      );
      const prefix = buildDynamicPrefix({
        lane: tone === 'warning' ? 'warning' : tone === 'coaching' ? 'coaching' : 'analysis',
        topic,
        conceptTested,
        mistakeType,
        selectedAnswerText,
        responsePace,
        repeatedMistakeCount,
        commonMistakePattern,
      });
      return `${prefix} ${message}`;
    }

    const layers = {
      analytical: [
        `Analysis: response pace (${responsePace}) suggests an avoidable verification miss. Pattern: ${commonMistakePattern}`,
        `Observed signal: attention drift under time pressure, not a deep knowledge gap. Pattern: ${commonMistakePattern}`,
        `Timing profile points to rushed decision control rather than conceptual weakness. Pattern: ${commonMistakePattern}`,
        `Evidence indicates a last-step verification failure caused by pace pressure. Pattern: ${commonMistakePattern}`,
      ],
      coaching: [
        `Coach note: you were close, but rushed the final decision. Add one verification pass. Pattern: ${commonMistakePattern}`,
        `The concept is likely known; the failure came from execution haste. Pattern: ${commonMistakePattern}`,
        `Build a short pre-submit routine to convert near-correct reasoning into correct outcomes. Pattern: ${commonMistakePattern}`,
        `Slow the final 5 seconds and validate your selected option once before submission. Pattern: ${commonMistakePattern}`,
      ],
      warning: [
        `Warning: repeated rushing is now a consistent mark-loss pattern. Signal: ${commonMistakePattern}`,
        `If pace control is not fixed, careless errors will keep compounding. Signal: ${commonMistakePattern}`,
        `This repeated haste pattern is now materially harming score stability. Signal: ${commonMistakePattern}`,
        `Continuing with the same pace behavior will keep generating avoidable losses. Signal: ${commonMistakePattern}`,
      ],
    };
    const message = pickVariant(
      layers[tone],
      `${topic}-${conceptTested}-${selectedAnswerText}-why-careless-${tone}`
    );
    const prefix = buildDynamicPrefix({
      lane: tone === 'warning' ? 'warning' : tone === 'coaching' ? 'coaching' : 'analysis',
      topic,
      conceptTested,
      mistakeType,
      selectedAnswerText,
      responsePace,
      repeatedMistakeCount,
      commonMistakePattern,
    });
    return `${prefix} ${message}`;
  }

  if (selectedAnswerText) {
    if (mistakeType === 'Concept Error') {
      const prefix = buildDynamicPrefix({
        lane: 'analysis',
        topic,
        conceptTested,
        mistakeType,
        selectedAnswerText,
        responsePace,
      });
      return `${prefix} You selected "${selectedAnswerText}" in ${topic}. This reflects a misconception in ${conceptTested}, not just a one-off slip.`;
    }
    const prefix = buildDynamicPrefix({
      lane: mistakeType === 'Careless Mistake' ? 'coaching' : 'analysis',
      topic,
      conceptTested,
      mistakeType,
      selectedAnswerText,
      responsePace,
    });
    return `${prefix} You selected "${selectedAnswerText}" in ${topic}. The miss came from ${mistakeType} around ${conceptTested}.`;
  }

  if (mistakeType === 'Concept Error') {
    const prefix = buildDynamicPrefix({
      lane: 'warning',
      topic,
      conceptTested,
      mistakeType,
      responsePace,
      repeatedMistakeCount,
      commonMistakePattern,
    });
    return `${prefix} This miss in ${topic} suggests a misconception while applying ${conceptTested}.`;
  }
  const prefix = buildDynamicPrefix({
    lane: mistakeType === 'Careless Mistake' ? 'coaching' : 'analysis',
    topic,
    conceptTested,
    mistakeType,
    responsePace,
    repeatedMistakeCount,
    commonMistakePattern,
  });
  return `${prefix} This miss in ${topic} likely came from ${mistakeType} while applying ${conceptTested}.`;
};

const getPerformanceLabel = ({ topicAccuracy }) => {
  const acc = Number(topicAccuracy || 0);
  if (acc >= 80) return 'Strong';
  if (acc >= 50) return 'Improving';
  return 'Needs Attention';
};

const buildMotivationMessage = ({ isCorrect, topic, repeatedMistakeCount, performanceLabel, confidenceInsight }) => {
  if (isCorrect && performanceLabel !== 'Needs Attention') {
    if (confidenceInsight === 'slow-correct') {
      return `Solid understanding in ${topic}. Next milestone: improve speed without losing accuracy.`;
    }
    return `You're consistently improving in ${topic}. Keep the momentum.`;
  }

  if (!isCorrect && repeatedMistakeCount >= 2) {
    return `You're repeating the same mistake in ${topic}. Slow down and compare concepts before selecting.`;
  }

  if (isCorrect) {
    return `Nice recovery in ${topic}. One more focused question can lock this concept in.`;
  }

  return `Stay with ${topic} for a few more guided questions and accuracy will climb.`;
};

module.exports = {
  buildImprovementTip,
  buildWhyGotWrong,
  getPerformanceLabel,
  classifyMistake,
  buildMotivationMessage,
  buildActionableFix,
  buildConfidenceInsight,
};
