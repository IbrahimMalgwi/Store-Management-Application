import jwt from "jsonwebtoken";
import { DEFAULT_INSTANCE_ID } from "../src/database/seed.js";

const JWT_SECRET = process.env.JWT_SECRET || "stockos_secret_key_123";

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = {
      ...user,
      instanceId: user.instanceId || DEFAULT_INSTANCE_ID,
    };
    next();
  });
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
