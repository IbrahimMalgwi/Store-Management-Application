import express from "express";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, requirePermission } from "../middleware/auth.js";
import { createSeedData } from "../src/database/seed.js";
import { recordAuditLog } from "../src/audit.js";

const router = express.Router();

router.use(authenticateToken, requirePermission("manageData"));

router.delete("/history", (req, res) => {
  const db = getDB();
  const deletedTransactions = db.txns.filter(txn => txn.instanceId === req.user.instanceId).length;
  const items = db.items.map(item => item.instanceId === req.user.instanceId ? ({ ...item, sold: 0 }) : item);
  const txns = db.txns.filter(txn => txn.instanceId !== req.user.instanceId);
  const notifications = db.notifications.filter(notification => notification.instanceId !== req.user.instanceId);

  saveCollection("txns", txns);
  saveCollection("notifications", notifications);
  saveCollection("items", items);
  recordAuditLog({
    req,
    action: "admin.history_delete",
    entityType: "data",
    entityId: req.user.instanceId,
    summary: "Deleted sales history",
    metadata: { deletedTransactions },
  });

  res.json({ message: "Sales history deleted", txns: 0, notifications: 0, items: items.filter(item => item.instanceId === req.user.instanceId) });
});

router.post("/reset", async (req, res) => {
  const mode = req.body?.mode || "fresh";
  const db = getDB();
  const currentAdmin = db.users.find(user => user.id === req.user.id && user.instanceId === req.user.instanceId);

  if (!currentAdmin) {
    return res.status(400).json({ message: "Current admin account could not be found" });
  }

  if (mode === "seed") {
    const seed = await createSeedData();
    const items = [
      ...db.items.filter(item => item.instanceId !== req.user.instanceId),
      ...seed.items.map(item => ({ ...item, instanceId: req.user.instanceId })),
    ];
    const users = [
      ...db.users.filter(user => user.instanceId !== req.user.instanceId),
      { ...currentAdmin, role: "owner", active: true },
      ...seed.users.filter(user => user.role !== "owner").map(user => ({ ...user, instanceId: req.user.instanceId })),
    ];
    const txns = [
      ...db.txns.filter(txn => txn.instanceId !== req.user.instanceId),
      ...seed.txns.map(txn => ({ ...txn, instanceId: req.user.instanceId })),
    ];
    const notifications = [
      ...db.notifications.filter(notification => notification.instanceId !== req.user.instanceId),
      ...seed.notifications.map(notification => ({ ...notification, instanceId: req.user.instanceId })),
    ];
    const refreshTokens = (db.refreshTokens || []).filter(token => token.instanceId !== req.user.instanceId);
    const stockAdjustments = (db.stockAdjustments || []).filter(adjustment => adjustment.instanceId !== req.user.instanceId);
    const customers = (db.customers || []).filter(customer => customer.instanceId !== req.user.instanceId);

    saveCollection("items", items);
    saveCollection("users", users);
    saveCollection("txns", txns);
    saveCollection("notifications", notifications);
    saveCollection("refreshTokens", refreshTokens);
    saveCollection("stockAdjustments", stockAdjustments);
    saveCollection("customers", customers);
    recordAuditLog({
      req,
      action: "admin.reset_demo",
      entityType: "data",
      entityId: req.user.instanceId,
      summary: "Restored demo data",
      metadata: { items: seed.items.length, users: seed.users.length, transactions: seed.txns.length },
    });

    return res.json({ message: "Demo data restored", data: { items, users, txns, notifications } });
  }

  const items = db.items.filter(item => item.instanceId !== req.user.instanceId);
  const users = [
    ...db.users.filter(user => user.instanceId !== req.user.instanceId),
    { ...currentAdmin, role: "owner", active: true },
  ];
  const txns = db.txns.filter(txn => txn.instanceId !== req.user.instanceId);
  const notifications = db.notifications.filter(notification => notification.instanceId !== req.user.instanceId);
  const refreshTokens = (db.refreshTokens || []).filter(token => token.instanceId !== req.user.instanceId);
  const stockAdjustments = (db.stockAdjustments || []).filter(adjustment => adjustment.instanceId !== req.user.instanceId);
  const customers = (db.customers || []).filter(customer => customer.instanceId !== req.user.instanceId);

  saveCollection("items", items);
  saveCollection("users", users);
  saveCollection("txns", txns);
  saveCollection("notifications", notifications);
  saveCollection("refreshTokens", refreshTokens);
  saveCollection("stockAdjustments", stockAdjustments);
  saveCollection("customers", customers);
  recordAuditLog({
    req,
    action: "admin.reset_fresh",
    entityType: "data",
    entityId: req.user.instanceId,
    summary: "Started fresh and cleared instance data",
  });

  res.json({ message: "Data cleared. Current admin account was kept.", data: { items, users, txns, notifications } });
});

export default router;
