import express from "express";
import bcrypt from "bcryptjs";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, normalizeRole, requirePermission } from "../middleware/auth.js";
import { hasSeatCapacity } from "../src/license.js";

const router = express.Router();

// Apply admin protection to all routes in this file
router.use(authenticateToken, requirePermission("manageUsers"));

const VALID_ROLES = ["owner", "manager", "cashier", "viewer"];
const MIN_PASSWORD_LENGTH = 8;

// GET all users
router.get("/", (req, res) => {
  const db = getDB();
  // Don't return password hashes in list if not necessary, but for simplicity of this app, we can omit them or keep them.
  // The original app has a modal that populates password. To allow displaying/editing, let's keep it simple, but security-wise it's good to not send them.
  // Actually, since the original code populates password input in the modal, we can return the plain properties or hash them. 
  // Returning password hashes isn't safe, but for the modal to work we can just return a placeholder or allow setting a new password.
  // Let's modify the modal logic slightly so that if the admin wants to change password they type a new one, else it stays unchanged.
  // So we return users without password or with dummy passwords, but to make the code changes to the frontend minimal:
  // we can return users and if the user password field in request matches the DB or is a placeholder, we don't re-hash it.
  // Let's return users. For the password field, we can return a placeholder like "******".
  const safeUsers = db.users
    .filter(user => user.instanceId === req.user.instanceId)
    .map(u => ({ ...u, password: "●●●●●●" }));
  res.json(safeUsers);
});

// POST add new user
router.post("/", async (req, res) => {
  const { name, email, password, role, active } = req.body;
  const normalizedRole = normalizeRole(role);

  if (!name || !email || !password || !normalizedRole) {
    return res.status(400).json({ message: "Name, email, password, and role are required" });
  }

  if (!VALID_ROLES.includes(normalizedRole)) {
    return res.status(400).json({ message: "Invalid role selected" });
  }

  const db = getDB();
  const instance = db.instances.find(item => item.id === req.user.instanceId);
  const activeUserCount = db.users.filter(u => u.instanceId === req.user.instanceId && u.active).length;

  if ((active === undefined || active) && !hasSeatCapacity(instance?.license, activeUserCount)) {
    return res.status(403).json({ message: "This license has reached its active user seat limit" });
  }

  // Check if email already taken
  if (db.users.find(u => u.instanceId === req.user.instanceId && u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ message: "A user with this email already exists" });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = {
    id: Date.now(),
    instanceId: req.user.instanceId,
    name,
    email,
    password: hashedPassword,
    role: normalizedRole,
    createdAt: new Date().toISOString().split("T")[0],
    active: active !== undefined ? active : true,
  };

  db.users.push(newUser);
  saveCollection("users", db.users);

  // Return user with placeholder password
  res.status(201).json({ ...newUser, password: "●●●●●●" });
});

// PUT update user
router.put("/:id", async (req, res) => {
  const userId = Number(req.params.id);
  const { name, email, password, role, active } = req.body;
  const normalizedRole = normalizeRole(role);

  if (!name || !email || !normalizedRole) {
    return res.status(400).json({ message: "Name, email, and role are required" });
  }

  if (!VALID_ROLES.includes(normalizedRole)) {
    return res.status(400).json({ message: "Invalid role selected" });
  }

  const db = getDB();
  const index = db.users.findIndex(u => u.id === userId && u.instanceId === req.user.instanceId);

  if (index === -1) {
    return res.status(404).json({ message: "User not found" });
  }

  // Check if email taken by another user
  const emailExists = db.users.find(u => u.instanceId === req.user.instanceId && u.email.toLowerCase() === email.toLowerCase() && u.id !== userId);
  if (emailExists) {
    return res.status(400).json({ message: "A user with this email already exists" });
  }

  const existingUser = db.users[index];
  const instance = db.instances.find(item => item.id === req.user.instanceId);
  const activeUserCount = db.users.filter(u => u.instanceId === req.user.instanceId && u.active && u.id !== userId).length;
  const nextActive = active !== undefined ? active : existingUser.active;

  if (nextActive && !hasSeatCapacity(instance?.license, activeUserCount)) {
    return res.status(403).json({ message: "This license has reached its active user seat limit" });
  }

  let updatedPassword = existingUser.password;

  // Hash new password if it is provided and is NOT the placeholder
  if (password && password !== "●●●●●●" && password !== "******") {
    const salt = await bcrypt.genSalt(10);
    updatedPassword = await bcrypt.hash(password, salt);
  }

  const updatedUser = {
    ...existingUser,
    name,
    email,
    password: updatedPassword,
    role: normalizedRole,
    active: active !== undefined ? active : existingUser.active,
  };

  db.users[index] = updatedUser;
  saveCollection("users", db.users);

  res.json({ ...updatedUser, password: "●●●●●●" });
});

router.post("/:id/reset-password", async (req, res) => {
  const userId = Number(req.params.id);
  const { password, confirmPassword } = req.body;

  if (req.user.id === userId) {
    return res.status(400).json({ message: "Use change password for your own account" });
  }

  if (!password || !confirmPassword) {
    return res.status(400).json({ message: "Password and confirmation are required" });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Password and confirmation do not match" });
  }

  const db = getDB();
  const index = db.users.findIndex(u => u.id === userId && u.instanceId === req.user.instanceId);

  if (index === -1) {
    return res.status(404).json({ message: "User not found" });
  }

  const salt = await bcrypt.genSalt(10);
  db.users[index] = {
    ...db.users[index],
    password: await bcrypt.hash(password, salt),
    passwordUpdatedAt: new Date().toISOString(),
  };

  saveCollection("users", db.users);

  db.refreshTokens = (db.refreshTokens || []).map(token =>
    token.userId === userId && token.instanceId === req.user.instanceId && !token.revokedAt
      ? { ...token, revokedAt: new Date().toISOString() }
      : token
  );
  saveCollection("refreshTokens", db.refreshTokens);

  res.json({ message: "Password reset successfully" });
});

// DELETE user
router.delete("/:id", (req, res) => {
  const userId = Number(req.params.id);

  if (req.user.id === userId) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  const db = getDB();
  const index = db.users.findIndex(u => u.id === userId && u.instanceId === req.user.instanceId);

  if (index === -1) {
    return res.status(404).json({ message: "User not found" });
  }

  db.users.splice(index, 1);
  saveCollection("users", db.users);

  db.refreshTokens = (db.refreshTokens || []).map(token =>
    token.userId === userId && token.instanceId === req.user.instanceId && !token.revokedAt
      ? { ...token, revokedAt: new Date().toISOString() }
      : token
  );
  saveCollection("refreshTokens", db.refreshTokens);

  res.json({ message: "User deleted successfully" });
});

export default router;
