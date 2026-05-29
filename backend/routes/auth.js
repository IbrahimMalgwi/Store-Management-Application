import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, normalizeRole } from "../middleware/auth.js";
import { getLicenseAccess } from "../src/license.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "stockos_secret_key_123";
const MIN_PASSWORD_LENGTH = 8;

router.post("/login", async (req, res) => {
  const { email, password, role, instanceId, instanceSlug } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const db = getDB();
  const requestedInstance = instanceId
    ? db.instances.find(instance => instance.id === instanceId)
    : instanceSlug
      ? db.instances.find(instance => instance.slug === instanceSlug)
      : null;

  const requestedRole = role ? normalizeRole(role) : null;
  let candidates = db.users.filter(u => u.email === email && (!requestedRole || normalizeRole(u.role) === requestedRole));
  if (requestedInstance) {
    candidates = candidates.filter(u => u.instanceId === requestedInstance.id);
  }

  if (!requestedInstance && candidates.length > 1) {
    return res.status(400).json({ message: "Multiple instances use this account. Select an instance to continue." });
  }

  const user = candidates[0];
  const instance = user ? db.instances.find(item => item.id === user.instanceId) : null;

  if (!user || !instance) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (!instance.active) {
    return res.status(403).json({ message: "This business instance is inactive" });
  }

  const licenseAccess = getLicenseAccess(instance.license);
  if (!licenseAccess.allowed) {
    return res.status(403).json({ message: licenseAccess.reason });
  }

  if (!user.active) {
    return res.status(403).json({ message: "Account is inactive. Contact admin" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const userRole = normalizeRole(user.role);

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: userRole, instanceId: user.instanceId },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: userRole,
      active: user.active,
      instanceId: user.instanceId,
      instanceName: instance.name,
      instanceSlug: instance.slug,
      license: instance.license
    }
  });
});

router.put("/password", authenticateToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "Current password, new password, and confirmation are required" });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New password and confirmation do not match" });
  }

  const db = getDB();
  const index = db.users.findIndex(user => user.id === req.user.id && user.instanceId === req.user.instanceId);
  const user = index >= 0 ? db.users[index] : null;

  if (!user) {
    return res.status(404).json({ message: "Account not found" });
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    return res.status(400).json({ message: "New password must be different from the current password" });
  }

  const salt = await bcrypt.genSalt(10);
  db.users[index] = {
    ...user,
    password: await bcrypt.hash(newPassword, salt),
    passwordUpdatedAt: new Date().toISOString(),
  };

  saveCollection("users", db.users);

  res.json({ message: "Password changed successfully" });
});

export default router;
