import express from "express";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

const cleanBusinessProfile = (profile = {}) => ({
  businessName: String(profile.businessName || "").trim(),
  address: String(profile.address || "").trim(),
  phone: String(profile.phone || "").trim(),
  email: String(profile.email || "").trim(),
});

router.use(authenticateToken);

router.get("/business-profile", (req, res) => {
  const db = getDB();
  res.json(db.businessProfile);
});

router.put("/business-profile", requireAdmin, (req, res) => {
  const profile = cleanBusinessProfile(req.body);

  if (!profile.businessName || !profile.address || !profile.phone || !profile.email) {
    return res.status(400).json({ message: "Business name, address, phone, and email are required" });
  }

  const db = getDB();
  db.businessProfile = profile;
  saveCollection("businessProfile", profile);

  res.json({
    message: "Business profile updated",
    businessProfile: profile,
  });
});

export default router;
