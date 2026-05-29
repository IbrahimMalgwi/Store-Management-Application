import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getDB } from "../db.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "stockos_secret_key_123";

router.post("/login", async (req, res) => {
  const { email, password, role, instanceId, instanceSlug } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: "Email, password, and role are required" });
  }

  const db = getDB();
  const requestedInstance = instanceId
    ? db.instances.find(instance => instance.id === instanceId)
    : instanceSlug
      ? db.instances.find(instance => instance.slug === instanceSlug)
      : null;

  let candidates = db.users.filter(u => u.email === email && u.role === role);
  if (requestedInstance) {
    candidates = candidates.filter(u => u.instanceId === requestedInstance.id);
  }

  if (!requestedInstance && candidates.length > 1) {
    return res.status(400).json({ message: "Multiple instances use this account. Select an instance to continue." });
  }

  const user = candidates[0];
  const instance = user ? db.instances.find(item => item.id === user.instanceId) : null;

  if (!user || !instance) {
    return res.status(401).json({ message: "Invalid credentials or wrong role selected" });
  }

  if (!instance.active) {
    return res.status(403).json({ message: "This business instance is inactive" });
  }

  if (!user.active) {
    return res.status(403).json({ message: "Account is inactive. Contact admin" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials or wrong role selected" });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, instanceId: user.instanceId },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      instanceId: user.instanceId,
      instanceName: instance.name,
      instanceSlug: instance.slug
    }
  });
});

export default router;
