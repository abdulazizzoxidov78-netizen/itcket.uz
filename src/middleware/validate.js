function validateBody(requiredFields = []) {
  return (req, res, next) => {
    const missing = [];
    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Quyidagi maydonlar to'ldirilishi shart: ${missing.join(', ')}`,
      });
    }

    next();
  };
}

module.exports = {
  validateBody,
};
