import express from "express";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Apply auth protection to all routes in this file
router.use(authenticateToken);

// GET notifications
router.get("/", (req, res) => {
  const db = getDB();
  res.json(db.notifications);
});

// POST add notification
router.post("/", (req, res) => {
  const { message, time } = req.body;

  if (!message) {
    return res.status(400).json({ message: "Notification message is required" });
  }

  const db = getDB();
  const newNotif = {
    id: Date.now(),
    message,
    time: time || new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }) + " today",
    unread: true
  };

  db.notifications.unshift(newNotif); // Add to beginning of list
  saveCollection("notifications", db.notifications);

  res.status(201).json(newNotif);
});

// POST mark all read
router.post("/mark-read", (req, res) => {
  const db = getDB();
  db.notifications = db.notifications.map(n => ({ ...n, unread: false }));
  saveCollection("notifications", db.notifications);

  res.json({ message: "All notifications marked as read", notifications: db.notifications });
});

export default router;
