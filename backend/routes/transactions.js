import express from "express";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, hasPermission, requirePermission } from "../middleware/auth.js";
import { recordAuditLog } from "../src/audit.js";
import { reserveReceiptNumber } from "../src/receiptNumbering.js";
import { recordStockAdjustment } from "../src/stockAdjustments.js";
import { syncLowStockAlert } from "../src/lowStockAlerts.js";
import { resolveSaleCustomer } from "../src/customers.js";

const router = express.Router();

const fallbackBusinessProfile = (profile) => ({
  businessName: profile?.businessName || "StockOS",
  address: profile?.address || "Store Management Platform",
  phone: profile?.phone || "",
  email: profile?.email || "",
});

const findReceiptTransactions = (db, receiptId, instanceId) =>
  db.txns.filter(t => t.instanceId === instanceId && (t.saleId === receiptId || String(t.id) === String(receiptId)));

const canAccessReceipt = (req, txns) =>
  hasPermission(req.user.role, "viewAllTransactions") || txns.every(t => t.userId === req.user.id);

const getRefundableQty = txn => Number(txn.qty || 0) - Number(txn.refundedQty || 0);

// GET transactions (Admin sees all, User sees only their own)
router.get("/", authenticateToken, (req, res) => {
  const db = getDB();
  const instanceTxns = db.txns.filter(t => t.instanceId === req.user.instanceId);
  if (hasPermission(req.user.role, "viewAllTransactions")) {
    res.json(instanceTxns);
  } else {
    const userTxns = instanceTxns.filter(t => t.userId === req.user.id);
    res.json(userTxns);
  }
});

router.get("/refunds", authenticateToken, requirePermission("viewAllTransactions"), (req, res) => {
  const db = getDB();
  res.json((db.refunds || [])
    .filter(refund => refund.instanceId === req.user.instanceId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
});

// POST create transaction (Make a sale)
router.post("/", authenticateToken, requirePermission("sell"), (req, res) => {
  const { cartItems, customer, customerId } = req.body;

  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ message: "Cart items are required to make a sale" });
  }

  const db = getDB();
  let customerDetails = resolveSaleCustomer({ db, req, customerId, customer });

  if (customerId && !customerDetails) {
    return res.status(404).json({ message: "Customer record not found" });
  }

  if (!customerDetails?.name || !customerDetails.address || !customerDetails.contact) {
    return res.status(400).json({ message: "Customer name, address, and a phone number or email address are required for the receipt" });
  }

  if (!customerDetails.id) {
    const now = new Date().toISOString();
    const newCustomer = {
      ...customerDetails,
      id: Date.now() + Math.random(),
      instanceId: req.user.instanceId,
      createdBy: req.user.id,
      createdAt: now,
      updatedAt: now,
    };
    db.customers.push(newCustomer);
    saveCollection("customers", db.customers);
    customerDetails = newCustomer;
    recordAuditLog({
      req,
      action: "customer.create",
      entityType: "customer",
      entityId: newCustomer.id,
      summary: `Created customer ${newCustomer.name} during sale`,
      metadata: { name: newCustomer.name, phone: newCustomer.phone, email: newCustomer.email },
    });
  }

  const instance = db.instances.find(item => item.id === req.user.instanceId);
  const businessProfile = fallbackBusinessProfile(instance?.businessProfile);
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const { receiptNo, nextSettings } = reserveReceiptNumber(instance?.receiptSettings);
  const saleId = receiptNo;

  // First check all items for stock availability
  for (const cartItem of cartItems) {
    const item = db.items.find(i => i.id === Number(cartItem.id) && i.instanceId === req.user.instanceId);
    if (!item) {
      return res.status(404).json({ message: `Item with ID ${cartItem.id} not found` });
    }
    if (item.qty < cartItem.qty) {
      return res.status(400).json({ message: `Insufficient stock for ${item.name}. Available: ${item.qty}, Requested: ${cartItem.qty}` });
    }
  }

  const newTxns = [];
  const stockDeductions = [];

  // Process deduction and transaction creation
  db.items = db.items.map(item => {
    const cartItem = cartItems.find(c => Number(c.id) === item.id);
    if (item.instanceId === req.user.instanceId && cartItem) {
      // Create transaction record
      newTxns.push({
        id: Date.now() + Math.random(),
        instanceId: req.user.instanceId,
        saleId,
        receiptNo: saleId,
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        qty: cartItem.qty,
        amount: item.amount * cartItem.qty,
        unitAmount: item.amount,
        unitCost: Number(item.purchaseCost || 0),
        costAmount: Number(item.purchaseCost || 0) * cartItem.qty,
        profit: (item.amount - Number(item.purchaseCost || 0)) * cartItem.qty,
        category: item.category || "General",
        supplier: item.supplier || "",
        customer: customerDetails,
        customerId: customerDetails.id,
        businessProfile,
        receiptPrinted: false,
        receiptPrintedAt: null,
        receiptPrintedBy: null,
        refundedQty: 0,
        refundedAmount: 0,
        refundedCostAmount: 0,
        refundedProfit: 0,
        userId: req.user.id,
        userName: req.user.name,
        date,
        time,
      });

      // Update inventory stock
      const nextItem = {
        ...item,
        qty: item.qty - cartItem.qty,
        sold: item.sold + cartItem.qty
      };
      stockDeductions.push({
        item: nextItem,
        previousQty: item.qty,
        newQty: nextItem.qty,
        referenceId: saleId,
      });
      return nextItem;
    }
    return item;
  });

  // Save changes to database
  db.txns.push(...newTxns);
  db.instances = db.instances.map(item => item.id === req.user.instanceId ? ({ ...item, receiptSettings: nextSettings }) : item);
  saveCollection("items", db.items);
  saveCollection("txns", db.txns);
  saveCollection("instances", db.instances);
  stockDeductions.forEach(({ item, previousQty, newQty, referenceId }) => {
    syncLowStockAlert({ db, item, previousQty });
    recordStockAdjustment({
      db,
      req,
      item,
      previousQty,
      newQty,
      type: "sale",
      reason: `Sale ${referenceId}`,
      referenceType: "sale",
      referenceId,
    });
  });
  recordAuditLog({
    req,
    action: "sale.create",
    entityType: "sale",
    entityId: saleId,
    summary: `Completed sale ${saleId} for ${customerDetails.name}`,
    metadata: {
      receiptNo: saleId,
      customerName: customerDetails.name,
      itemCount: newTxns.length,
      total: newTxns.reduce((sum, txn) => sum + txn.amount, 0),
      profit: newTxns.reduce((sum, txn) => sum + txn.profit, 0),
    },
  });

  res.status(201).json({
    message: "Sale completed successfully",
    transactions: newTxns,
    receipt: {
      id: saleId,
      receiptNo: saleId,
      customer: customerDetails,
      customerId: customerDetails.id,
      businessProfile,
      transactions: newTxns,
      total: newTxns.reduce((sum, txn) => sum + txn.amount, 0),
      profit: newTxns.reduce((sum, txn) => sum + txn.profit, 0),
      date,
      time,
      userId: req.user.id,
      userName: req.user.name,
      receiptPrinted: false,
    },
    items: db.items.filter(item => item.instanceId === req.user.instanceId)
  });
});

router.post("/:receiptId/refund", authenticateToken, requirePermission("manageRefunds"), (req, res) => {
  const db = getDB();
  const receiptTxns = findReceiptTransactions(db, req.params.receiptId, req.user.instanceId);
  if (receiptTxns.length === 0) return res.status(404).json({ message: "Receipt not found" });

  const requestedLines = Array.isArray(req.body?.items) ? req.body.items : [];
  const reason = String(req.body?.reason || "").trim();
  if (!reason) return res.status(400).json({ message: "A refund reason is required" });
  if (requestedLines.length === 0) return res.status(400).json({ message: "Select at least one item to refund" });

  const lines = [];
  const selectedTransactionIds = new Set();
  for (const requestedLine of requestedLines) {
    const txn = receiptTxns.find(item => String(item.id) === String(requestedLine.transactionId));
    const qty = Number(requestedLine.qty);
    const restock = requestedLine.restock !== false;

    if (!txn) return res.status(400).json({ message: "A selected refund item does not belong to this receipt" });
    if (selectedTransactionIds.has(String(txn.id))) return res.status(400).json({ message: `${txn.itemName} was selected more than once` });
    selectedTransactionIds.add(String(txn.id));
    if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ message: `Refund quantity for ${txn.itemName} must be a positive whole number` });
    if (qty > getRefundableQty(txn)) return res.status(400).json({ message: `Refund quantity for ${txn.itemName} exceeds the remaining refundable quantity` });

    const inventoryItem = db.items.find(item => item.id === txn.itemId && item.instanceId === req.user.instanceId);
    if (restock && !inventoryItem) {
      return res.status(400).json({ message: `${txn.itemName} no longer exists in inventory. Process it without restocking or recreate the item first.` });
    }

    const unitAmount = Number(txn.unitAmount ?? Number(txn.amount || 0) / Number(txn.qty || 1));
    const unitCost = Number(txn.unitCost || 0);
    lines.push({
      transactionId: txn.id,
      itemId: txn.itemId,
      sku: txn.sku,
      itemName: txn.itemName,
      qty,
      restock,
      unitAmount,
      unitCost,
      amount: unitAmount * qty,
      costAmount: unitCost * qty,
      profit: (unitAmount - unitCost) * qty,
    });
  }

  const now = new Date().toISOString();
  const refund = {
    id: Date.now() + Math.random(),
    instanceId: req.user.instanceId,
    receiptId: req.params.receiptId,
    receiptNo: receiptTxns[0].receiptNo || req.params.receiptId,
    customer: receiptTxns[0].customer,
    reason,
    items: lines,
    qty: lines.reduce((sum, line) => sum + line.qty, 0),
    amount: lines.reduce((sum, line) => sum + line.amount, 0),
    costAmount: lines.reduce((sum, line) => sum + line.costAmount, 0),
    profit: lines.reduce((sum, line) => sum + line.profit, 0),
    processedBy: req.user.id,
    processedByName: req.user.name,
    createdAt: now,
  };

  db.txns = db.txns.map(txn => {
    const line = lines.find(item => String(item.transactionId) === String(txn.id));
    return line
      ? {
          ...txn,
          refundedQty: Number(txn.refundedQty || 0) + line.qty,
          refundedAmount: Number(txn.refundedAmount || 0) + line.amount,
          refundedCostAmount: Number(txn.refundedCostAmount || 0) + line.costAmount,
          refundedProfit: Number(txn.refundedProfit || 0) + line.profit,
        }
      : txn;
  });

  const stockRestorations = [];
  db.items = db.items.map(item => {
    const restoredQty = lines
      .filter(line => line.restock && line.itemId === item.id)
      .reduce((sum, line) => sum + line.qty, 0);
    if (item.instanceId !== req.user.instanceId || restoredQty === 0) return item;

    const nextItem = { ...item, qty: item.qty + restoredQty, sold: Math.max(0, Number(item.sold || 0) - restoredQty) };
    stockRestorations.push({ item: nextItem, previousQty: item.qty, newQty: nextItem.qty });
    return nextItem;
  });

  db.refunds = [...(db.refunds || []), refund];
  saveCollection("txns", db.txns);
  saveCollection("items", db.items);
  saveCollection("refunds", db.refunds);
  stockRestorations.forEach(({ item, previousQty, newQty }) => {
    syncLowStockAlert({ db, item, previousQty });
    recordStockAdjustment({
      db,
      req,
      item,
      previousQty,
      newQty,
      type: "refund_restock",
      reason,
      referenceType: "refund",
      referenceId: refund.id,
    });
  });
  recordAuditLog({
    req,
    action: "sale.refund",
    entityType: "refund",
    entityId: refund.id,
    summary: `Refunded ${refund.qty} unit(s) from receipt ${refund.receiptNo}`,
    metadata: { receiptNo: refund.receiptNo, reason, amount: refund.amount, items: lines },
  });

  res.status(201).json({
    message: "Refund processed successfully",
    refund,
    transactions: findReceiptTransactions(db, req.params.receiptId, req.user.instanceId),
    items: db.items.filter(item => item.instanceId === req.user.instanceId),
  });
});

// POST mark receipt as printed. Users can print a receipt once; admins can print without consuming that user print.
router.post("/:receiptId/print", authenticateToken, (req, res) => {
  if (!hasPermission(req.user.role, "printReceipts")) {
    return res.status(403).json({ message: "You do not have permission to print receipts" });
  }

  const db = getDB();
  const receiptTxns = findReceiptTransactions(db, req.params.receiptId, req.user.instanceId);

  if (receiptTxns.length === 0) {
    return res.status(404).json({ message: "Receipt not found" });
  }

  if (!canAccessReceipt(req, receiptTxns)) {
    return res.status(403).json({ message: "You do not have access to this receipt" });
  }

  if (!hasPermission(req.user.role, "reprintReceipts") && receiptTxns.some(t => t.receiptPrinted)) {
    return res.status(409).json({ message: "This receipt has already been printed" });
  }

  if (!hasPermission(req.user.role, "reprintReceipts")) {
    const printedAt = new Date().toISOString();
    db.txns = db.txns.map(txn => {
      if (receiptTxns.some(t => t.id === txn.id)) {
        return {
          ...txn,
          receiptPrinted: true,
          receiptPrintedAt: printedAt,
          receiptPrintedBy: req.user.id,
        };
      }
      return txn;
    });
    saveCollection("txns", db.txns);
  }

  const updatedReceiptTxns = findReceiptTransactions(db, req.params.receiptId, req.user.instanceId);
  recordAuditLog({
    req,
    action: hasPermission(req.user.role, "reprintReceipts") ? "receipt.reprint" : "receipt.print",
    entityType: "receipt",
    entityId: req.params.receiptId,
    summary: `Printed receipt ${req.params.receiptId}`,
    metadata: { receiptId: req.params.receiptId, transactionRows: updatedReceiptTxns.length },
  });

  res.json({
    message: "Receipt print allowed",
    receiptPrinted: updatedReceiptTxns.some(t => t.receiptPrinted),
    transactions: updatedReceiptTxns,
  });
});

export default router;
