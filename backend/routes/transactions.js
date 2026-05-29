import express from "express";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, hasPermission, requirePermission } from "../middleware/auth.js";

const router = express.Router();

const sanitizeCustomer = (customer = {}) => ({
  name: String(customer.name || "").trim(),
  address: String(customer.address || "").trim(),
  contact: String(customer.contact || "").trim(),
});

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

// POST create transaction (Make a sale)
router.post("/", authenticateToken, requirePermission("sell"), (req, res) => {
  const { cartItems, customer } = req.body;
  const customerDetails = sanitizeCustomer(customer);

  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ message: "Cart items are required to make a sale" });
  }

  if (!customerDetails.name || !customerDetails.address || !customerDetails.contact) {
    return res.status(400).json({ message: "Customer name, address, and contact are required for the receipt" });
  }

  const db = getDB();
  const instance = db.instances.find(item => item.id === req.user.instanceId);
  const businessProfile = fallbackBusinessProfile(instance?.businessProfile);
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const saleId = `SALE-${Date.now()}`;

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
        customer: customerDetails,
        businessProfile,
        receiptPrinted: false,
        receiptPrintedAt: null,
        receiptPrintedBy: null,
        userId: req.user.id,
        userName: req.user.name,
        date,
        time,
      });

      // Update inventory stock
      return {
        ...item,
        qty: item.qty - cartItem.qty,
        sold: item.sold + cartItem.qty
      };
    }
    return item;
  });

  // Save changes to database
  db.txns.push(...newTxns);
  saveCollection("items", db.items);
  saveCollection("txns", db.txns);

  res.status(201).json({
    message: "Sale completed successfully",
    transactions: newTxns,
    receipt: {
      id: saleId,
      receiptNo: saleId,
      customer: customerDetails,
      businessProfile,
      transactions: newTxns,
      total: newTxns.reduce((sum, txn) => sum + txn.amount, 0),
      date,
      time,
      userId: req.user.id,
      userName: req.user.name,
      receiptPrinted: false,
    },
    items: db.items.filter(item => item.instanceId === req.user.instanceId)
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
  res.json({
    message: "Receipt print allowed",
    receiptPrinted: updatedReceiptTxns.some(t => t.receiptPrinted),
    transactions: updatedReceiptTxns,
  });
});

export default router;
