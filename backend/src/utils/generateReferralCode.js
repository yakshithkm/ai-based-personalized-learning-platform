const crypto = require('crypto');

// Excludes visually-ambiguous characters (0/O, 1/I/L) so a code read off a
// screen or spoken aloud can't be mistyped into a different valid code.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

// Generates one candidate code, e.g. "ABC123XY". Uniqueness against existing
// users is enforced by the caller (User model's pre-save hook), which retries
// on collision - this function only needs to produce well-formed candidates.
const generateReferralCode = () => {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
};

module.exports = generateReferralCode;