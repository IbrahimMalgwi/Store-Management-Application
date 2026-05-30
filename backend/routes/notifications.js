import express from "express";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, requirePermission } from "../middleware/auth.js";
import { syncInstanceLowStockAlerts } from "../src/lowStockAlerts.js";

const router = express.Router();

// Apply auth protection to all routes in this file
router.use(authenticateToken);

// GET notifications
router.get("/", (req, res) => {
  const db = getDB();
  syncInstanceLowStockAlerts({ db, instanceId: req.user.instanceId });
  res.json(db.notifications.filter(notification => notification.instanceId === req.user.instanceId));
});

// POST add notification
router.post("/", requirePermission("manageInventory"), (req, res) => {
  const { message, time } = req.body;

  if (!message) {
    return res.status(400).json({ message: "Notification message is required" });
  }

  const db = getDB();
  const newNotif = {
    id: Date.now(),
    instanceId: req.user.instanceId,
    message,
    time: time || new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }) + " today",
    unread: true
  };

  db.notifications.unshift(newNotif); // Add to beginning of list
  saveCollection("notifications", db.notifications);

  res.status(201).json(newNotif);
});

// POST mark all read
router.post("/mark-read", requirePermission("manageInventory"), (req, res) => {
  const db = getDB();
  db.notifications = db.notifications.map(n => n.instanceId === req.user.instanceId ? ({ ...n, unread: false }) : n);
  saveCollection("notifications", db.notifications);

  res.json({ message: "All notifications marked as read", notifications: db.notifications.filter(notification => notification.instanceId === req.user.instanceId) });
});

export default router;
