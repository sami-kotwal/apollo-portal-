const express = require("express");
const { registerUser, registerCustomer, forgotPassword, loginUser, getCurrentUser } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

router.post("/register", protect, adminOnly, registerUser);
router.post("/customer/register", registerCustomer);
router.post("/forgot-password", forgotPassword);
router.post("/login", loginUser);
router.get("/me", protect, getCurrentUser);

module.exports = router;
