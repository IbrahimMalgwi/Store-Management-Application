import jwt from "jsonwebtoken";
import { DEFAULT_INSTANCE_ID } from "../src/database/seed.js";

const JWT_SECRET = process.env.JWT_SECRET || "stockos_secret_key_123";

export const ROLE_PERMISSIONS = {
  owner: [
    "viewReports",
    "viewInventory",
    "manageInventory",
    "viewAllTransactions",
    "sell",
    "printReceipts",
    "reprintReceipts",
    "manageUsers",
    "manageSettings",
    "manageData",
  ],
  manager: [
    "viewReports",
    "viewInventory",
    "manageInventory",
    "viewAllTransactions",
    "sell",
    "printReceipts",
    "reprintReceipts",
  ],
  cashier: [
    "viewOwnReports",
    "viewInventory",
    "sell",
    "printReceipts",
  ],
  viewer: [
    "viewReports",
    "viewInventory",
    "viewAllTransactions",
  ],
};

export const normalizeRole = (role) => {
  if (role === "admin") return "owner";
  if (role === "user") return "cashier";
  return role;
};

export const hasPermission = (role, permission) =>
  ROLE_PERMISSIONS[normalizeRole(role)]?.includes(permission) || false;

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
      role: normalizeRole(user.role),
      instanceId: user.instanceId || DEFAULT_INSTANCE_ID,
    };
    next();
  });
};

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user || !hasPermission(req.user.role, permission)) {
    return res.status(403).json({ message: "You do not have permission to perform this action" });
  }
  next();
};

export const requireAdmin = requirePermission("manageInventory");
