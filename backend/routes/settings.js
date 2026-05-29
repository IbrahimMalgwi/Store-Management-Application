import express from "express";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, requirePermission } from "../middleware/auth.js";
import { cleanLicenseInput, getLicenseAccess, LICENSE_MODES, LICENSE_PLANS, LICENSE_STATUSES } from "../src/license.js";
import { recordAuditLog } from "../src/audit.js";
import { formatReceiptNumber, normalizeReceiptSettings } from "../src/receiptNumbering.js";

const router = express.Router();

const cleanBusinessProfile = (profile = {}) => ({
  businessName: String(profile.businessName || "").trim(),
  address: String(profile.address || "").trim(),
  phone: String(profile.phone || "").trim(),
  email: String(profile.email || "").trim(),
});

const getInstance = (instanceId) => getDB().instances.find(item => item.id === instanceId);

router.use(authenticateToken);

router.get("/business-profile", (req, res) => {
  const instance = getInstance(req.user.instanceId);

  if (!instance) {
    return res.status(404).json({ message: "Instance not found" });
  }

  res.json(instance.businessProfile);
});

router.get("/license", (req, res) => {
  const instance = getInstance(req.user.instanceId);

  if (!instance) {
    return res.status(404).json({ message: "Instance not found" });
  }

  res.json({
    ...instance.license,
    access: getLicenseAccess(instance.license),
    options: {
      modes: LICENSE_MODES,
      plans: LICENSE_PLANS,
      statuses: LICENSE_STATUSES,
    },
  });
});

router.get("/receipt-numbering", (req, res) => {
  const instance = getInstance(req.user.instanceId);

  if (!instance) {
    return res.status(404).json({ message: "Instance not found" });
  }

  const receiptSettings = normalizeReceiptSettings(instance.receiptSettings);
  res.json({
    ...receiptSettings,
    preview: formatReceiptNumber(receiptSettings),
  });
});

router.put("/business-profile", requirePermission("manageSettings"), (req, res) => {
  const profile = cleanBusinessProfile(req.body);

  if (!profile.businessName || !profile.address || !profile.phone || !profile.email) {
    return res.status(400).json({ message: "Business name, address, phone, and email are required" });
  }

  const db = getDB();
  const index = db.instances.findIndex(instance => instance.id === req.user.instanceId);

  if (index === -1) {
    return res.status(404).json({ message: "Instance not found" });
  }

  const previousProfile = db.instances[index].businessProfile;
  db.instances[index] = {
    ...db.instances[index],
    businessProfile: profile,
  };

  saveCollection("instances", db.instances);
  recordAuditLog({
    req,
    action: "settings.business_profile_update",
    entityType: "settings",
    entityId: req.user.instanceId,
    summary: "Updated business profile settings",
    metadata: { before: previousProfile, after: profile },
  });

  res.json({
    message: "Business profile updated",
    businessProfile: profile,
  });
});

router.put("/license", requirePermission("manageSettings"), (req, res) => {
  const license = cleanLicenseInput(req.body);

  if (license.mode === "saas" && !license.expiresAt) {
    return res.status(400).json({ message: "SaaS licenses require an expiry date" });
  }

  const db = getDB();
  const index = db.instances.findIndex(instance => instance.id === req.user.instanceId);

  if (index === -1) {
    return res.status(404).json({ message: "Instance not found" });
  }

  const activeUserCount = db.users.filter(user => user.instanceId === req.user.instanceId && user.active).length;
  if (license.seats < activeUserCount) {
    return res.status(400).json({ message: `Seat limit cannot be lower than the current ${activeUserCount} active users` });
  }

  const previousLicense = db.instances[index].license;
  db.instances[index] = {
    ...db.instances[index],
    plan: license.plan,
    license,
  };

  saveCollection("instances", db.instances);
  recordAuditLog({
    req,
    action: "settings.license_update",
    entityType: "settings",
    entityId: req.user.instanceId,
    summary: `Updated license settings to ${license.mode}/${license.plan}`,
    metadata: { before: previousLicense, after: license },
  });

  res.json({
    message: "License settings updated",
    license: {
      ...license,
      access: getLicenseAccess(license),
    },
  });
});

router.put("/receipt-numbering", requirePermission("manageSettings"), (req, res) => {
  const receiptSettings = normalizeReceiptSettings(req.body);
  const db = getDB();
  const index = db.instances.findIndex(instance => instance.id === req.user.instanceId);

  if (index === -1) {
    return res.status(404).json({ message: "Instance not found" });
  }

  const previousSettings = normalizeReceiptSettings(db.instances[index].receiptSettings);
  db.instances[index] = {
    ...db.instances[index],
    receiptSettings,
  };

  saveCollection("instances", db.instances);
  recordAuditLog({
    req,
    action: "settings.receipt_numbering_update",
    entityType: "settings",
    entityId: req.user.instanceId,
    summary: `Updated receipt numbering to ${formatReceiptNumber(receiptSettings)}`,
    metadata: { before: previousSettings, after: receiptSettings },
  });

  res.json({
    message: "Receipt numbering settings updated",
    receiptSettings: {
      ...receiptSettings,
      preview: formatReceiptNumber(receiptSettings),
    },
  });
});

export default router;
