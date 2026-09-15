const PDFDocument = require('pdfkit');
const {
  BRAND,
  FONT,
  registerFonts,
  watermarkAllPages,
  ensureSpace,
  drawDivider,
  drawSectionTitle,
  drawKeyValueGrid,
  drawTable,
  addPageNumbers,
} = require('./pdfHelpers');

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '-';

const formatDuration = (totalSeconds = 0) => {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const formatMode = (mode) => (mode === 'full-length' ? 'Full-Length Exam' : 'Section-Wise Test');
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const optionLetter = (index) => OPTION_LETTERS[index] ?? String(index + 1);

const OUTCOME_LABEL = { correct: 'Correct', incorrect: 'Incorrect', unanswered: 'Unanswered' };
const OUTCOME_COLOR = { correct: BRAND.success, incorrect: BRAND.danger, unanswered: BRAND.muted };

/**
 * Builds (but does not send) the full "Exam Simulation Report" PDF for one submitted
 * session. Every figure here is read from `session.resultSummary` (written once by
 * examSimulationService.submitExamSession) plus the per-question detail assembled by
 * examDownloadService - nothing is recalculated. Returns a pdfkit PDFDocument that the
 * caller pipes to the HTTP response.
 */
const buildExamReportPdf = ({ session, questionDetails, studentName }) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, autoFirstPage: true });
  registerFonts(doc);
  // Report pages are text-dense (especially the Q&A section), so the watermark is kept
  // smaller and fainter than the certificate's to stay a background texture rather than
  // visually competing with paragraphs of question text.
  watermarkAllPages(doc, { opacity: 0.03, sizeFraction: 0.4 });
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const summary = session.resultSummary || {};
  const scoreSummary = summary.scoreSummary || {};
  const postTestAnalysis = summary.postTestAnalysis || {};
  const scoreInterpretation = summary.scoreInterpretation || {};

  // ---- Header ----
  doc
    .font(FONT.bold)
    .fontSize(20)
    .fillColor(BRAND.primary)
    .text('TutorMind', doc.page.margins.left, doc.y, { width: usableWidth, align: 'center' });
  doc
    .font(FONT.regular)
    .fontSize(10)
    .fillColor(BRAND.muted)
    .text('AI-Based Personalized Learning Platform', doc.page.margins.left, doc.y, {
      width: usableWidth,
      align: 'center',
    });
  doc.x = doc.page.margins.left;
  doc.moveDown(0.6);
  doc.font(FONT.bold).fontSize(16).fillColor(BRAND.text).text('Exam Simulation Report');
  doc.moveDown(0.5);

  drawKeyValueGrid(doc, [
    ['Exam Type', session.examType],
    ['Exam Mode', formatMode(session.mode)],
    ['Section / Subject', session.sectionSubject || 'All Subjects'],
    ['Student Name', studentName || 'Student'],
    ['Exam Date', formatDate(session.startedAt)],
    ['Submission Date', formatDate(session.submittedAt)],
  ]);

  drawDivider(doc);

  // ---- Performance Summary ----
  drawSectionTitle(doc, 'Performance Summary');
  const totalAttempted = Number(scoreSummary.correct || 0) + Number(scoreSummary.wrong || 0);
  const accuracy = totalAttempted ? (Number(scoreSummary.correct || 0) / totalAttempted) * 100 : 0;
  const perQuestionTimeSec = (postTestAnalysis.timeSpentPerSubject || []).reduce(
    (sum, row) => sum + Number(row.timeSpentSec || 0),
    0
  );
  // Per-question timing can legitimately sum to 0 (e.g. individual question timing
  // wasn't captured for this attempt) even though the student clearly spent real time
  // on the exam. Falling back to the session's own wall-clock duration - already an
  // authoritative, stored timestamp pair - means "Time Taken" never misleadingly reads
  // 0m 0s for a completed exam.
  const wallClockTimeSec =
    session.startedAt && session.submittedAt
      ? Math.max(0, Math.round((new Date(session.submittedAt) - new Date(session.startedAt)) / 1000))
      : 0;
  const totalTimeSec = perQuestionTimeSec > 0 ? perQuestionTimeSec : wallClockTimeSec;

  drawKeyValueGrid(doc, [
    ['Total Score', `${scoreSummary.totalScore ?? '-'} / ${scoreSummary.maxScore ?? '-'}`],
    ['Accuracy', `${accuracy.toFixed(1)}%`],
    ['Correct Answers', scoreSummary.correct ?? 0],
    ['Incorrect Answers', scoreSummary.wrong ?? 0],
    ['Unanswered', scoreSummary.unattempted ?? 0],
    ['Time Taken', formatDuration(totalTimeSec)],
    ['Percentile Estimate', `${scoreSummary.percentileEstimate ?? '-'}%`],
    ['Estimated Rank Range', `${scoreSummary.rankRange?.low ?? '-'} - ${scoreSummary.rankRange?.high ?? '-'}`],
  ]);

  drawDivider(doc);

  // ---- Subject Performance ----
  drawSectionTitle(doc, 'Subject Performance');
  const bySubject = new Map();
  (postTestAnalysis.accuracyPerSubject || []).forEach((row) => bySubject.set(row.subject, { ...row }));
  (postTestAnalysis.timeSpentPerSubject || []).forEach((row) => {
    const existing = bySubject.get(row.subject) || { subject: row.subject };
    bySubject.set(row.subject, {
      ...existing,
      timeSpentSec: row.timeSpentSec,
      avgTimePerAttemptSec: row.avgTimePerAttemptSec,
    });
  });
  const subjectRows = Array.from(bySubject.values());

  // Per-question timing (perQuestionTimeSec, computed above) can be entirely absent for
  // an attempt even though the session's overall wall-clock duration is known (that's
  // what powers "Time Taken" above) - in that case every subject row's real
  // timeSpentSec is 0, and the columns would otherwise show nothing useful. Rather than
  // leave them blank, distribute the known total duration across subjects proportional
  // to questions attempted, and label the columns as an estimate so it stays honest
  // about not being measured per-question.
  const totalAttemptedAcrossSubjects = subjectRows.reduce((sum, row) => sum + Number(row.attempted || 0), 0);
  const usingEstimatedSubjectTime = perQuestionTimeSec === 0 && totalTimeSec > 0 && totalAttemptedAcrossSubjects > 0;

  if (subjectRows.length) {
    drawTable(doc, {
      columns: [
        { label: 'Subject', width: 100 },
        { label: 'Attempted', width: 75 },
        { label: 'Accuracy', width: 75 },
        { label: usingEstimatedSubjectTime ? 'Time Spent (est.)' : 'Time Spent', width: 95 },
        { label: 'Avg / Question', width: usableWidth - 100 - 75 - 75 - 95 },
      ],
      rows: subjectRows.map((row) => {
        const attempted = Number(row.attempted || 0);
        let timeSpentSec = Number(row.timeSpentSec || 0);
        let avgTimeSec = Number(row.avgTimePerAttemptSec || 0);

        if (usingEstimatedSubjectTime) {
          timeSpentSec = totalAttemptedAcrossSubjects
            ? Math.round((attempted / totalAttemptedAcrossSubjects) * totalTimeSec)
            : 0;
          avgTimeSec = attempted ? timeSpentSec / attempted : 0;
        }

        return [
          row.subject,
          `${attempted}/${row.total ?? 0}`,
          `${Number(row.accuracy || 0).toFixed(1)}%`,
          timeSpentSec ? formatDuration(timeSpentSec) : '-',
          avgTimeSec ? `${avgTimeSec.toFixed(1)}s` : '-',
        ];
      }),
    });

    if (usingEstimatedSubjectTime) {
      doc.moveDown(0.2);
      doc
        .font(FONT.regular)
        .fontSize(8)
        .fillColor(BRAND.muted)
        .text(
          '* Per-question timing was not recorded for this attempt. Time spent per subject is estimated by ' +
            'distributing the total exam duration across subjects in proportion to questions attempted.',
          doc.page.margins.left,
          doc.y,
          { width: usableWidth }
        );
    }
  } else {
    doc.font(FONT.regular).fontSize(10).fillColor(BRAND.muted).text('No subject-level data available for this attempt.');
  }

  // ---- Questions & Answers ----
  doc.addPage();
  drawSectionTitle(doc, 'Questions & Answers');
  doc
    .font(FONT.regular)
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text('Questions are listed in the exact order they appeared during the exam.');
  doc.moveDown(0.4);

  questionDetails.forEach((q) => {
    ensureSpace(doc, 70);

    doc
      .font(FONT.bold)
      .fontSize(10.5)
      .fillColor(BRAND.text)
      .text(`Q${q.questionNumber}. ${q.text}`, { width: usableWidth });

    doc
      .font(FONT.regular)
      .fontSize(8.5)
      .fillColor(BRAND.muted)
      .text(`Subject: ${q.subject} | Topic: ${q.topic}`, { width: usableWidth });
    doc.moveDown(0.25);

    (q.options || []).forEach((opt, idx) => {
      const isSelected = q.selectedAnswerIndex === idx;
      const isCorrectOpt = q.correctAnswerIndex === idx;

      doc
        .font(isSelected || isCorrectOpt ? FONT.bold : FONT.regular)
        .fontSize(9.5)
        .fillColor(isCorrectOpt ? BRAND.success : isSelected ? BRAND.danger : BRAND.text)
        .text(`   ${optionLetter(idx)}. ${opt}`, { width: usableWidth - 10 });
    });

    doc.moveDown(0.2);

    doc.font(FONT.bold).fontSize(9).fillColor(BRAND.muted).text('Student Answer: ', { continued: true });
    doc
      .font(FONT.regular)
      .fillColor(BRAND.text)
      .text(
        q.selectedAnswerIndex !== null
          ? `${optionLetter(q.selectedAnswerIndex)}. ${q.selectedAnswerText || ''}`
          : 'Not Attempted'
      );

    doc.font(FONT.bold).fontSize(9).fillColor(BRAND.muted).text('Correct Answer: ', { continued: true });
    doc
      .font(FONT.regular)
      .fillColor(BRAND.text)
      .text(q.correctAnswerIndex !== null ? `${optionLetter(q.correctAnswerIndex)}. ${q.correctAnswerText || ''}` : '-');

    doc
      .font(FONT.bold)
      .fontSize(9)
      .fillColor(OUTCOME_COLOR[q.outcome])
      .text(`Result: ${OUTCOME_LABEL[q.outcome]}`);

    if (q.timeTakenSec) {
      doc
        .font(FONT.regular)
        .fontSize(8.5)
        .fillColor(BRAND.muted)
        .text(`Time Taken: ${formatDuration(q.timeTakenSec)}`);
    }

    drawDivider(doc, { before: 4, after: 8 });
  });

  // ---- Analysis ----
  doc.addPage();
  drawSectionTitle(doc, 'Analysis');

  doc.font(FONT.bold).fontSize(10).fillColor(BRAND.text).text('Score Interpretation');
  doc.font(FONT.regular).fontSize(9.5).fillColor(BRAND.muted);
  [
    scoreInterpretation.message,
    scoreInterpretation.rankMessage,
    scoreInterpretation.strengthWeaknessMessage,
    scoreInterpretation.whyThisRank,
    scoreInterpretation.howScoreCompares,
  ]
    .filter(Boolean)
    .forEach((line) => doc.text(line, { width: usableWidth }));
  doc.moveDown(0.4);

  const listSection = (title, items, formatter) => {
    ensureSpace(doc, 40);
    doc.font(FONT.bold).fontSize(10).fillColor(BRAND.text).text(title);
    doc.font(FONT.regular).fontSize(9.5).fillColor(BRAND.muted);
    if (!items.length) {
      doc.text('None detected for this attempt.');
    } else {
      items.forEach((item) => doc.text(`-  ${formatter(item)}`, { width: usableWidth }));
    }
    doc.moveDown(0.4);
  };

  listSection('Strong Subjects', postTestAnalysis.strongSubjects || [], (s) => `${s.subject} (${s.accuracy}% accuracy)`);
  listSection('Weak Subjects', postTestAnalysis.weakSubjects || [], (s) => `${s.subject} (${s.accuracy}% accuracy)`);
  listSection(
    'Weak Topics / Mistake Patterns',
    postTestAnalysis.topMistakes || [],
    (m) => `${m.subject} - ${m.concept}: ${m.count} repeated mistake(s)`
  );

  ensureSpace(doc, 50);
  doc.font(FONT.bold).fontSize(10).fillColor(BRAND.text).text('Improvement Projection');
  doc
    .font(FONT.regular)
    .fontSize(9.5)
    .fillColor(BRAND.muted)
    .text(postTestAnalysis.improvementProjection?.message || 'Keep practicing consistently to improve your score.', {
      width: usableWidth,
    });
  doc.moveDown(0.4);

  listSection(
    'Recommended Next Actions',
    summary.adaptiveFollowUp?.nextPracticePlan || [],
    (a) => `${a.label} - ${a.reason}`
  );

  addPageNumbers(doc);
  return doc;
};

module.exports = { buildExamReportPdf };