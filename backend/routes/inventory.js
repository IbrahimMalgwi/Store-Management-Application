import express from "express";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, requirePermission } from "../middleware/auth.js";
import { recordAuditLog } from "../src/audit.js";

const router = express.Router();

const cleanItemInput = (body = {}) => ({
  sku: String(body.sku || "").trim(),
  name: String(body.name || "").trim(),
  qty: Number(body.qty),
  amount: Number(body.amount),
  purchaseCost: Number(body.purchaseCost || 0),
  category: String(body.category || "General").trim(),
  supplier: String(body.supplier || "").trim(),
  description: String(body.description || "").trim(),
});

// GET all items (Admins see all, Users see all)
router.get("/", authenticateToken, (req, res) => {
  const db = getDB();
  res.json(db.items.filter(item => item.instanceId === req.user.instanceId));
});

// POST add new item (Admin only)
router.post("/", authenticateToken, requirePermission("manageInventory"), (req, res) => {
  const { sku, name, qty, amount, purchaseCost, category, supplier, description } = cleanItemInput(req.body);

  if (!sku || !name || !Number.isFinite(qty) || qty < 0 || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(purchaseCost) || purchaseCost < 0) {
    return res.status(400).json({ message: "SKU, name, non-negative quantity, selling price, and purchase cost are required" });
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
    purchaseCost,
    category,
    supplier,
    description,
    sold: 0
  };

  db.items.push(newItem);
  saveCollection("items", db.items);
  recordAuditLog({
    req,
    action: "inventory.create",
    entityType: "item",
    entityId: newItem.id,
    summary: `Created item ${newItem.sku} - ${newItem.name}`,
    metadata: { sku: newItem.sku, name: newItem.name, qty: newItem.qty, amount: newItem.amount, purchaseCost: newItem.purchaseCost, category, supplier },
  });

  res.status(201).json(newItem);
});

// POST bulk add/update stock (Admin only)
router.post("/bulk", authenticateToken, requirePermission("manageInventory"), (req, res) => {
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
    const { sku, name, qty, amount, purchaseCost, category, supplier, description } = cleanItemInput(raw);

    if (!sku || !name || !Number.isFinite(qty) || qty < 0 || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(purchaseCost) || purchaseCost < 0) {
      errors.push(`Row ${rowNumber}: SKU, name, non-negative qty, selling price, and purchase cost are required`);
      return;
    }

    const existing = db.items.find(item => item.instanceId === req.user.instanceId && item.sku.toLowerCase() === sku.toLowerCase());

    if (existing) {
      existing.name = name;
      existing.qty += qty;
      existing.amount = amount;
      existing.purchaseCost = purchaseCost;
      existing.category = category;
      existing.supplier = supplier;
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
      purchaseCost,
      category,
      supplier,
      description,
      sold: 0,
    });
    created += 1;
  });

  if (errors.length > 0) {
    return res.status(400).json({ message: "Some rows are invalid", errors });
  }

  saveCollection("items", db.items);
  recordAuditLog({
    req,
    action: "inventory.bulk_import",
    entityType: "item",
    summary: `Imported ${items.length} stock row(s): ${created} created, ${updated} updated`,
    metadata: { created, updated, total: items.length },
  });
  res.status(201).json({ message: "Bulk stock import completed", created, updated, total: items.length, items: db.items.filter(item => item.instanceId === req.user.instanceId) });
});

// PUT update item (Admin only)
router.put("/:id", authenticateToken, requirePermission("manageInventory"), (req, res) => {
  const itemId = Number(req.params.id);
  const { sku, name, qty, amount, purchaseCost, category, supplier, description } = cleanItemInput(req.body);

  if (!sku || !name || !Number.isFinite(qty) || qty < 0 || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(purchaseCost) || purchaseCost < 0) {
    return res.status(400).json({ message: "SKU, name, non-negative quantity, selling price, and purchase cost are required" });
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

  const previousItem = db.items[index];
  const updatedItem = {
    ...previousItem,
    sku,
    name,
    qty: Number(qty),
    amount: Number(amount),
    purchaseCost,
    category,
    supplier,
    description
  };

  db.items[index] = updatedItem;
  saveCollection("items", db.items);
  recordAuditLog({
    req,
    action: "inventory.update",
    entityType: "item",
    entityId: updatedItem.id,
    summary: `Updated item ${updatedItem.sku} - ${updatedItem.name}`,
    metadata: { before: previousItem, after: updatedItem },
  });

  res.json(updatedItem);
});

// DELETE item (Admin only)
router.delete("/:id", authenticateToken, requirePermission("manageInventory"), (req, res) => {
  const itemId = Number(req.params.id);
  const db = getDB();
  const index = db.items.findIndex(i => i.id === itemId && i.instanceId === req.user.instanceId);

  if (index === -1) {
    return res.status(404).json({ message: "Item not found" });
  }

  const [deletedItem] = db.items.splice(index, 1);
  saveCollection("items", db.items);
  recordAuditLog({
    req,
    action: "inventory.delete",
    entityType: "item",
    entityId: deletedItem.id,
    summary: `Deleted item ${deletedItem.sku} - ${deletedItem.name}`,
    metadata: { sku: deletedItem.sku, name: deletedItem.name },
  });

  res.json({ message: "Item deleted successfully" });
});

export default router;
