const crypto = require('crypto');

/**
 * Builds a stable, opaque reference ID for a submitted exam session's certificate/report.
 *
 * Deterministic by design: hashing the session's own ObjectId means the same session
 * always produces the same certificate ID, so repeated "Download Certificate" clicks
 * never mint a new one, and legacy sessions submitted before `certificateId` existed on
 * the schema can have theirs derived lazily on first download without ever changing on
 * later downloads. The Mongo ObjectId itself is never exposed - only a short salted hash
 * of it, prefixed with the exam type for readability.
 */
const generateCertificateId = ({ sessionId, examType }) => {
  const hash = crypto
    .createHash('sha256')
    .update(`tutormind-exam-certificate:${String(sessionId)}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();

  const examPrefix = (examType || 'GEN').toUpperCase();
  return `TM-${examPrefix}-${hash}`;
};

module.exports = { generateCertificateId };