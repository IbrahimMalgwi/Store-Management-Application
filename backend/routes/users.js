import express from "express";
import bcrypt from "bcryptjs";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Apply admin protection to all routes in this file
router.use(authenticateToken, requireAdmin);

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

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "Name, email, password, and role are required" });
  }

  const db = getDB();

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
    role,
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

  if (!name || !email || !role) {
    return res.status(400).json({ message: "Name, email, and role are required" });
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
    role,
    active: active !== undefined ? active : existingUser.active,
  };

  db.users[index] = updatedUser;
  saveCollection("users", db.users);

  res.json({ ...updatedUser, password: "●●●●●●" });
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

  res.json({ message: "User deleted successfully" });
});

export default router;
