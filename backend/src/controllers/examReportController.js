const { loadExamSessionForDownload } = require('../services/examDownloadService');
const { buildExamReportPdf } = require('../services/pdf/examReportPdf');
const { buildExamCertificatePdf } = require('../services/pdf/examCertificatePdf');

const sanitizeForFilename = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');

const streamPdf = (res, doc, filename) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.on('error', (error) => {
    // The stream may already be mid-flight to the client at this point, so we can only
    // end the response - a JSON error body can't be sent once headers/bytes are sent.
    if (!res.headersSent) {
      res.status(500);
    }
    res.end();
    // eslint-disable-next-line no-console
    console.error('PDF generation stream error:', error);
  });
  doc.pipe(res);
  doc.end();
};

const downloadExamReport = async (req, res, next) => {
  try {
    const { session, questionDetails } = await loadExamSessionForDownload({
      userId: req.user._id,
      sessionId: req.params.sessionId,
    });

    const doc = buildExamReportPdf({
      session,
      questionDetails,
      studentName: req.user.name,
    });

    const filename = `TutorMind_Exam_Report_${sanitizeForFilename(session.examType)}_${sanitizeForFilename(
      session.certificateId
    )}.pdf`;

    return streamPdf(res, doc, filename);
  } catch (error) {
    res.status(error.statusCode || 500);
    return next(error);
  }
};

const downloadExamCertificate = async (req, res, next) => {
  try {
    const { session } = await loadExamSessionForDownload({
      userId: req.user._id,
      sessionId: req.params.sessionId,
    });

    const doc = buildExamCertificatePdf({
      session,
      studentName: req.user.name,
    });

    const filename = `TutorMind_Certificate_${sanitizeForFilename(session.examType)}_${sanitizeForFilename(
      session.certificateId
    )}.pdf`;

    return streamPdf(res, doc, filename);
  } catch (error) {
    res.status(error.statusCode || 500);
    return next(error);
  }
};

module.exports = { downloadExamReport, downloadExamCertificate };