const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("role tokenVersion");

    if (!user) {
      return res.status(401).json({ message: "User session no longer exists" });
    }

    const decodedVersion = Number(decoded.tokenVersion || 0);
    const currentVersion = Number(user.tokenVersion || 0);

    if (decodedVersion !== currentVersion) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.user = {
      ...decoded,
      id: decoded.id,
      role: user.role,
      tokenVersion: currentVersion,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Token failed" });
  }
};
