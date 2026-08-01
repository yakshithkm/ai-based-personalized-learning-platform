const mongoose = require('mongoose');

/**
 * Returns a middleware that validates req.params[paramName] is a syntactically valid
 * MongoDB ObjectId, responding with a clean 400 if not. Without this, an invalid id
 * reaches a Mongoose query and throws a CastError whose default message exposes
 * internal model/field names to the client.
 */
const validateObjectIdParam = (paramName) => (req, res, next) => {
  const value = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ message: `Invalid ${paramName}` });
  }
  return next();
};

module.exports = { validateObjectIdParam };
