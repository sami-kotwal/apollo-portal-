const express = require("express");
const User = require("../models/User");
const CustomerRequest = require("../models/CustomerRequest");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const VALID_PACKAGE_IDS = new Set([
  "informative-basic",
  "informative-startup",
  "informative-professional",
  "ecommerce-startup",
  "ecommerce-professional",
  "ecommerce-business",
  "domain-email",
  "social-basic",
  "social-management",
  "branding-design",
]);

const customerOnly = (req, res, next) => {
  if (req.user?.role !== "customer") {
    return res.status(403).json({ message: "Customer access required" });
  }
  next();
};

const cleanText = (value = "", fallback = "") => String(value || fallback).trim();
const cleanSelectedPackage = (item) => {
  if (typeof item === "string") {
    const packageId = cleanText(item);
    return VALID_PACKAGE_IDS.has(packageId) ? packageId : "";
  }
  if (!item || typeof item !== "object") return "";
  const packageId = cleanText(item.packageId || item.id);
  if (!packageId || !VALID_PACKAGE_IDS.has(packageId)) return "";
  const billingCycle = ["monthly", "annual", "one_time"].includes(item.billingCycle) ? item.billingCycle : "monthly";
  return {
    packageId,
    billingCycle,
    price: cleanText(item.price),
    selectedAt: item.selectedAt || new Date().toISOString(),
  };
};

router.use(protect, customerOnly);

router.get("/summary", async (req, res) => {
  const [user, requests] = await Promise.all([
    User.findById(req.user.id).select("name email customerProfile").lean(),
    CustomerRequest.find({ customer: req.user.id }).sort({ createdAt: -1 }).lean(),
  ]);

  const selectedPackages = Array.isArray(user?.customerProfile?.selectedPackages)
    ? user.customerProfile.selectedPackages.map((item) => cleanSelectedPackage(item)).filter(Boolean)
    : [];

  res.json({
    user,
    selectedPackages,
    requests,
    counts: requests.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      { total: 0 }
    ),
  });
});

router.put("/packages", async (req, res) => {
  const selectedPackages = Array.isArray(req.body?.selectedPackages)
    ? req.body.selectedPackages.map((item) => cleanSelectedPackage(item)).filter(Boolean)
    : [];

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { "customerProfile.selectedPackages": selectedPackages } },
    { returnDocument: "after" }
  ).select("-password");

  res.json({ selectedPackages: user.customerProfile.selectedPackages, user });
});

router.post("/requests", async (req, res) => {
  const { type, title, details, priority } = req.body || {};
  if (!["logo", "website", "domain", "email", "ticket"].includes(type)) {
    return res.status(400).json({ message: "Invalid request type" });
  }
  if (!cleanText(title)) {
    return res.status(400).json({ message: "Title is required" });
  }

  const request = await CustomerRequest.create({
    customer: req.user.id,
    type,
    title: cleanText(title),
    priority: ["normal", "high", "urgent"].includes(priority) ? priority : "normal",
    details: details && typeof details === "object" ? details : {},
  });

  res.status(201).json(request);
});

router.post("/requests/:id/terms-consent", async (req, res) => {
  const { name, email, signature } = req.body || {};
  const cleanName = cleanText(name);
  const cleanEmail = cleanText(email).toLowerCase();
  const cleanSignature = cleanText(signature);

  if (!cleanName || !cleanEmail || !cleanSignature) {
    return res.status(400).json({ message: "Name, email, and signature are required" });
  }

  const request = await CustomerRequest.findOne({
    _id: req.params.id,
    customer: req.user.id,
    type: "domain",
    status: "domain_available",
  });

  if (!request) {
    return res.status(404).json({ message: "Domain consent request is not available" });
  }

  request.status = "terms_accepted";
  request.details = {
    ...(request.details || {}),
    subscriptionTermsConsent: {
      name: cleanName,
      email: cleanEmail,
      signature: cleanSignature,
      acceptedAt: new Date(),
      termsTitle: "Website Subscription Terms & Conditions",
    },
  };
  await request.save();

  res.json(request);
});

module.exports = router;
