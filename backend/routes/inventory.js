import express from "express";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// GET all items (Admins see all, Users see all)
router.get("/", authenticateToken, (req, res) => {
  const db = getDB();
  res.json(db.items.filter(item => item.instanceId === req.user.instanceId));
});

// POST add new item (Admin only)
router.post("/", authenticateToken, requireAdmin, (req, res) => {
  const { sku, name, qty, amount, description } = req.body;

  if (!sku || !name || qty === undefined || amount === undefined) {
    return res.status(400).json({ message: "SKU, Name, Quantity, and Price are required" });
  }

  const db = getDB();
  const instanceItems = db.items.filter(item => item.instanceId === req.user.instanceId);

  // Check if SKU already exists
  if (instanceItems.find(i => i.sku.toLowerCase() === sku.toLowerCase())) {
    return res.status(400).json({ message: "An item with this SKU already exists" });
  }

  const newItem = {
    id: Date.now(),
    instanceId: req.user.instanceId,
    sku,
    name,
    qty: Number(qty),
    amount: Number(amount),
    description: description || "",
    sold: 0
  };

  db.items.push(newItem);
  saveCollection("items", db.items);

  res.status(201).json(newItem);
});

// POST bulk add/update stock (Admin only)
router.post("/bulk", authenticateToken, requireAdmin, (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Import rows are required" });
  }

  const db = getDB();
  const errors = [];
  let created = 0;
  let updated = 0;

  items.forEach((raw, index) => {
    const rowNumber = index + 2;
    const sku = String(raw.sku || "").trim();
    const name = String(raw.name || "").trim();
    const qty = Number(raw.qty);
    const amount = Number(raw.amount);
    const description = String(raw.description || "").trim();

    if (!sku || !name || !Number.isFinite(qty) || qty < 0 || !Number.isFinite(amount) || amount < 0) {
      errors.push(`Row ${rowNumber}: SKU, name, non-negative qty, and non-negative price are required`);
      return;
    }

    const existing = db.items.find(item => item.instanceId === req.user.instanceId && item.sku.toLowerCase() === sku.toLowerCase());

    if (existing) {
      existing.name = name;
      existing.qty += qty;
      existing.amount = amount;
      existing.description = description;
      updated += 1;
      return;
    }

    db.items.push({
      id: Date.now() + index,
      instanceId: req.user.instanceId,
      sku,
      name,
      qty,
      amount,
      description,
      sold: 0,
    });
    created += 1;
  });

  if (errors.length > 0) {
    return res.status(400).json({ message: "Some rows are invalid", errors });
  }

  saveCollection("items", db.items);
  res.status(201).json({ message: "Bulk stock import completed", created, updated, total: items.length, items: db.items.filter(item => item.instanceId === req.user.instanceId) });
});

// PUT update item (Admin only)
router.put("/:id", authenticateToken, requireAdmin, (req, res) => {
  const itemId = Number(req.params.id);
  const { sku, name, qty, amount, description } = req.body;

  if (!sku || !name || qty === undefined || amount === undefined) {
    return res.status(400).json({ message: "SKU, Name, Quantity, and Price are required" });
  }

  const db = getDB();
  const index = db.items.findIndex(i => i.id === itemId && i.instanceId === req.user.instanceId);

  if (index === -1) {
    return res.status(404).json({ message: "Item not found" });
  }

  // Check if SKU is taken by another item
  const existingSkuItem = db.items.find(i => i.instanceId === req.user.instanceId && i.sku.toLowerCase() === sku.toLowerCase() && i.id !== itemId);
  if (existingSkuItem) {
    return res.status(400).json({ message: "An item with this SKU already exists" });
  }

  const updatedItem = {
    ...db.items[index],
    sku,
    name,
    qty: Number(qty),
    amount: Number(amount),
    description: description || ""
  };

  db.items[index] = updatedItem;
  saveCollection("items", db.items);

  res.json(updatedItem);
});

// DELETE item (Admin only)
router.delete("/:id", authenticateToken, requireAdmin, (req, res) => {
  const itemId = Number(req.params.id);
  const db = getDB();
  const index = db.items.findIndex(i => i.id === itemId && i.instanceId === req.user.instanceId);

  if (index === -1) {
    return res.status(404).json({ message: "Item not found" });
  }

  db.items.splice(index, 1);
  saveCollection("items", db.items);

  res.json({ message: "Item deleted successfully" });
});

export default router;
