const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const sanitizeAdmin = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  isAdmin: true,
});

// Dedicated /api/admin/login endpoint, kept separate from /api/auth/login per the
// admin-portal spec, but deliberately reusing the same User model, the same bcrypt
// comparison, and the same generateToken() used for student auth - the codebase
// already supports roles via User.isAdmin + the protect/requireAdmin middleware, so
// this extends that instead of standing up a second, conflicting credential system.
// The only behavioral difference from student login: a correct password for a
// non-admin account is rejected here with the same generic message as a wrong
// password, so this endpoint can't be used to test whether an email is registered
// or to distinguish "wrong password" from "not an admin".
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      res.status(400);
      throw new Error('Email and password are required');
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    const passwordOk = user ? await user.matchPassword(password) : false;

    if (!user || !passwordOk || !user.isAdmin) {
      res.status(401);
      throw new Error('Invalid admin credentials');
    }

    return res.json({
      user: sanitizeAdmin(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    return next(error);
  }
};

const getAdminProfile = async (req, res) => {
  res.json({ user: sanitizeAdmin(req.user) });
};

module.exports = { adminLogin, getAdminProfile };