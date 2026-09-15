const PDFDocument = require('pdfkit');
const { BRAND, FONT, registerFonts, drawWatermark } = require('./pdfHelpers');

const formatDate = (date) =>  date
    ? new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '-';

const formatSectionLabel = (session) =>
  session.mode === 'section-wise' && session.sectionSubject
    ? `${session.examType} - ${session.sectionSubject} Section Test`
    : `${session.examType} Full-Length Simulation`;

/**
 * Builds a single-page, landscape "TutorMind Exam Simulation Certificate". This is
 * explicitly a completion certificate for a practice simulation - not an official
 * board/government/competitive-exam credential - and says so on the face of the
 * document, per product requirements.
 */
const buildExamCertificatePdf = ({ session, studentName }) => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, bufferPages: true });
  registerFonts(doc);
  const { width, height } = doc.page;
  const summary = session.resultSummary || {};
  const scoreSummary = summary.scoreSummary || {};

 // Background wash
  doc.rect(0, 0, width, height).fill('#f8fafc');

 // Logo watermark - large, very low opacity, centered behind everything else. Drawn
  // before the border/text so it reads as a background texture rather than competing
  // with the foreground content for attention or legibility. The certificate is always
  // a single page, so drawWatermark (not watermarkAllPages) is enough here.
  drawWatermark(doc);

  // Decorative double border
  const outerMargin = 24;
  const innerMargin = 34;
  doc
    .save()
    .lineWidth(3)
    .strokeColor(BRAND.primary)
    .rect(outerMargin, outerMargin, width - outerMargin * 2, height - outerMargin * 2)
    .stroke()
    .lineWidth(1)
    .strokeColor(BRAND.border)
    .rect(innerMargin, innerMargin, width - innerMargin * 2, height - innerMargin * 2)
    .stroke()
    .restore();

  const contentX = innerMargin + 40;
  const contentWidth = width - (innerMargin + 40) * 2;
  let y = innerMargin + 40;

  doc
    .font(FONT.bold)
    .fontSize(22)
    .fillColor(BRAND.primary)
    .text('TutorMind', contentX, y, { width: contentWidth, align: 'center' });
  y += 30;
  doc
    .font(FONT.regular)
    .fontSize(10)
    .fillColor(BRAND.muted)
    .text('AI-Based Personalized Learning Platform', contentX, y, { width: contentWidth, align: 'center' });
  y += 34;

  doc
    .font(FONT.bold)
    .fontSize(28)
    .fillColor(BRAND.text)
    .text('Certificate of Exam Simulation Completion', contentX, y, { width: contentWidth, align: 'center' });
  y += 50;

  doc
    .font(FONT.regular)
    .fontSize(12)
    .fillColor(BRAND.muted)
    .text('This certificate is proudly presented to', contentX, y, { width: contentWidth, align: 'center' });
  y += 26;

  doc
    .font(FONT.serifBoldItalic)
    .fontSize(30)
    .fillColor(BRAND.primaryDark)
    .text(studentName || 'Student', contentX, y, { width: contentWidth, align: 'center' });
  y += 42;

  doc
    .font(FONT.regular)
    .fontSize(11.5)
    .fillColor(BRAND.text)
    .text(
      `for successfully completing the ${formatSectionLabel(session)} on the TutorMind platform, ` +
        'achieving the results summarized below.',
      contentX,
      y,
      { width: contentWidth, align: 'center' }
    );
  y += 44;

  const stats = [
    ['Score', `${scoreSummary.totalScore ?? '-'} / ${scoreSummary.maxScore ?? '-'}`],
    ['Accuracy', `${scoreSummary.correct + scoreSummary.wrong ? ((scoreSummary.correct / (scoreSummary.correct + scoreSummary.wrong)) * 100).toFixed(1) : '0.0'}%`],
    ['Percentile', `${scoreSummary.percentileEstimate ?? '-'}%`],
    ['Est. Rank', `${scoreSummary.rankRange?.low ?? '-'} - ${scoreSummary.rankRange?.high ?? '-'}`],
  ];
  const statBoxWidth = contentWidth / stats.length;
  stats.forEach(([label, value], index) => {
    const x = contentX + index * statBoxWidth;
    doc
      .font(FONT.bold)
      .fontSize(17)
      .fillColor(BRAND.primary)
      .text(value, x, y, { width: statBoxWidth, align: 'center' });
    doc
      .font(FONT.regular)
      .fontSize(9)
      .fillColor(BRAND.muted)
      .text(label.toUpperCase(), x, y + 22, { width: statBoxWidth, align: 'center' });
  });
  y += 56;

  doc
    .font(FONT.regular)
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text(
      'This certificate reflects performance in a TutorMind exam simulation and is intended for personal progress ' +
        'tracking. It is not an official mark sheet, government certification, or board/competitive-exam credential.',
      contentX,
      y,
      { width: contentWidth, align: 'center' }
    );

  // Footer: date (left), certificate id (right), signature block (center)
  const footerY = height - innerMargin - 70;
  doc
    .save()
    .strokeColor(BRAND.border)
    .lineWidth(1)
    .moveTo(contentX, footerY)
    .lineTo(contentX + contentWidth, footerY)
    .stroke()
    .restore();

  doc
    .font(FONT.regular)
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text('Completion Date', contentX, footerY + 12, { width: 180 });
  doc
    .font(FONT.bold)
    .fontSize(11)
    .fillColor(BRAND.text)
    .text(formatDate(session.submittedAt), contentX, footerY + 26, { width: 180 });

  const rightBlockWidth = 220;
  const rightBlockX = contentX + contentWidth - rightBlockWidth;
  doc
    .font(FONT.regular)
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text('Certificate Reference ID', rightBlockX, footerY + 12, { width: rightBlockWidth, align: 'right' });
  doc
    .font(FONT.bold)
    .fontSize(11)
    .fillColor(BRAND.text)
    .text(session.certificateId || '-', rightBlockX, footerY + 26, { width: rightBlockWidth, align: 'right' });

  doc
    .font(FONT.serifBoldItalic)
    .fontSize(20)
    .fillColor(BRAND.primaryDark)
    .text('TutorMind', contentX, footerY - 26, { width: contentWidth, align: 'center' });
  doc
    .font(FONT.regular)
    .fontSize(8.5)
    .fillColor(BRAND.muted)
    .text('Automated Platform Verification', contentX, footerY - 8, { width: contentWidth, align: 'center' });

  doc.bufferedPageRange();
  return doc;
};

module.exports = { buildExamCertificatePdf };