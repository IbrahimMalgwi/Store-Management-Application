import express from "express";
import { getDB, replaceDB, resetToSeed, saveCollection } from "../db.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.delete("/history", (req, res) => {
  const db = getDB();
  const items = db.items.map(item => ({ ...item, sold: 0 }));

  saveCollection("txns", []);
  saveCollection("notifications", []);
  saveCollection("items", items);

  res.json({ message: "Sales history deleted", txns: 0, notifications: 0, items });
});

router.post("/reset", async (req, res) => {
  const mode = req.body?.mode || "fresh";

  if (mode === "seed") {
    const nextData = await resetToSeed();
    return res.json({ message: "Demo data restored", data: nextData });
  }

  const db = getDB();
  const currentAdmin = db.users.find(user => user.id === req.user.id);

  if (!currentAdmin) {
    return res.status(400).json({ message: "Current admin account could not be found" });
  }

  const freshData = {
    businessProfile: db.businessProfile,
    items: [],
    users: [{ ...currentAdmin, role: "admin", active: true }],
    txns: [],
    notifications: [],
  };

  replaceDB(freshData);
  res.json({ message: "Data cleared. Current admin account was kept.", data: freshData });
});

export default router;
