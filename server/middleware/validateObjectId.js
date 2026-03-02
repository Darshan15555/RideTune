import mongoose from 'mongoose';

export function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

export function validateObjectIdParam(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!isValidObjectId(value)) {
      return res.status(400).json({ message: `Invalid ${paramName}` });
    }
    return next();
  };
}
