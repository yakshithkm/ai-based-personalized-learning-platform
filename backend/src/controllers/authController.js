const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  targetExam: user.targetExam,
});

const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, targetExam } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Name, email and password are required');
    }

    const exists = await User.findOne({ email });
    if (exists) {
      res.status(400);
      throw new Error('User already exists with this email');
    }

    const user = await User.create({ name, email, password, targetExam });

    return res.status(201).json({
      user: sanitizeUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    return next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Email and password are required');
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    return res.json({
      user: sanitizeUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    return next(error);
  }
};

const getProfile = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { registerUser, loginUser, getProfile };
