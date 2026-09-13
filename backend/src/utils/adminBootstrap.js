const User = require('../models/User');

// Reuses the existing User model + its bcrypt pre-save hook (see models/User.js)
// instead of inventing a parallel admin-credential store. The raw password from
// ADMIN_EMAIL/ADMIN_PASSWORD env vars is only ever used here, in-process, to
// create or update the hashed password on the admin's User document - it is
// never logged, returned by any API, or written anywhere in plaintext.
//
// Safe to call on every server start: if the admin already exists with the same
// password, User's pre-save hook no-ops the password field (isModified check)
// and nothing changes. If ADMIN_PASSWORD changed, the hash is updated. If the
// env vars are missing, this silently does nothing - existing admin accounts
// (if any were promoted directly in the database) keep working.
const bootstrapAdminUser = async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Platform Admin';

  if (!email || !password) {
    console.warn(
      '[admin-bootstrap] ADMIN_EMAIL / ADMIN_PASSWORD not set - skipping admin account setup. ' +
        'Set both in backend/.env to enable the admin login.'
    );
    return null;
  }

  if (password.length < 6) {
    console.warn('[admin-bootstrap] ADMIN_PASSWORD is shorter than 6 characters - skipping.');
    return null;
  }

  let admin = await User.findOne({ email });

  if (!admin) {
    admin = new User({ name, email, password, targetExam: 'JEE', isAdmin: true });
    await admin.save();
    console.log(`[admin-bootstrap] Created admin account for ${email}`);
    return admin;
  }

  let changed = false;

  if (!admin.isAdmin) {
    admin.isAdmin = true;
    changed = true;
  }

  const passwordMatches = await admin.matchPassword(password);
  if (!passwordMatches) {
    admin.password = password; // pre-save hook rehashes since the field is modified
    changed = true;
  }

  if (changed) {
    await admin.save();
    console.log(`[admin-bootstrap] Synced admin account for ${email}`);
  }

  return admin;
};

module.exports = { bootstrapAdminUser };