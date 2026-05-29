import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getDB } from "../db.js";
import { normalizeRole } from "../middleware/auth.js";
import { getLicenseAccess } from "../src/license.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "stockos_secret_key_123";

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

export default router;
