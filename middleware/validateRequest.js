const requireFields = (fields) => {
  return (req, res, next) => {
    const missingFields = fields.filter((field) => {
      const value = req.body[field];

      if (value === undefined || value === null) {
        return true;
      }

      if (typeof value === "string" && value.trim() === "") {
        return true;
      }

      return false;
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    next();
  };
};

module.exports = { requireFields };
