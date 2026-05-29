import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getDB } from "../db.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "stockos_secret_key_123";

router.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: "Email, password, and role are required" });
  }

  const db = getDB();
  const user = db.users.find(u => u.email === email && u.role === role);

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials or wrong role selected" });
  }

  if (!user.active) {
    return res.status(403).json({ message: "Account is inactive. Contact admin" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials or wrong role selected" });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
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
      active: user.active
    }
  });
});

export default router;
