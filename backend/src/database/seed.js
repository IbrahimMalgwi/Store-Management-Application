import bcrypt from "bcryptjs";
import { DEFAULT_LICENSE } from "../license.js";
import { DEFAULT_RECEIPT_SETTINGS } from "../receiptNumbering.js";

export const SEED_ITEMS = [
  { id: 1, sku: "SKU-001", name: "Wireless Headphones", qty: 45, reorderThreshold: 10, amount: 89.99, purchaseCost: 52.5, category: "Audio", supplier: "SoundLine Wholesale", description: "Premium noise-cancelling headphones", sold: 120 },
  { id: 2, sku: "SKU-002", name: "USB-C Hub 7-in-1", qty: 12, reorderThreshold: 8, amount: 34.99, purchaseCost: 18.75, category: "Accessories", supplier: "PortPro Supplies", description: "Multi-port USB hub for laptops", sold: 85 },
  { id: 3, sku: "SKU-003", name: "Mechanical Keyboard", qty: 8, reorderThreshold: 10, amount: 129.99, purchaseCost: 74, category: "Computer Gear", supplier: "KeyWorks Distribution", description: "RGB backlit 60% layout", sold: 60 },
  { id: 4, sku: "SKU-004", name: "Webcam HD 1080p", qty: 22, reorderThreshold: 8, amount: 59.99, purchaseCost: 31.25, category: "Computer Gear", supplier: "VisionTech Supply", description: "Full HD webcam with mic", sold: 44 },
  { id: 5, sku: "SKU-005", name: "Mouse Pad XL", qty: 3, reorderThreshold: 6, amount: 19.99, purchaseCost: 7.5, category: "Accessories", supplier: "DeskMate Imports", description: "Extended gaming mouse pad", sold: 200 },
  { id: 6, sku: "SKU-006", name: "LED Desk Lamp", qty: 30, reorderThreshold: 8, amount: 44.99, purchaseCost: 21.4, category: "Office", supplier: "BrightDesk Ltd", description: "Adjustable brightness, USB charging", sold: 75 },
];

export const SEED_NOTIFICATIONS = [
  { id: 1, message: "Jane Doe logged in", time: "09:12 today", unread: true },
  { id: 2, message: "Mark Lee logged in", time: "08:45 today", unread: true },
  { id: 3, message: "Priya Shah completed a $432.00 sale", time: "Yesterday", unread: false },
];

export const DEFAULT_BUSINESS_PROFILE = {
  businessName: "StockOS Demo Store",
  address: "Update your business address",
  phone: "Update phone number",
  email: "Update email address",
};

export const DEFAULT_INSTANCE_ID = "default-instance";

export const DEFAULT_INSTANCE = {
  id: DEFAULT_INSTANCE_ID,
  name: "Default Store",
  slug: "default",
  businessProfile: { ...DEFAULT_BUSINESS_PROFILE },
  receiptSettings: { ...DEFAULT_RECEIPT_SETTINGS },
  plan: DEFAULT_LICENSE.plan,
  license: { ...DEFAULT_LICENSE },
  active: true,
  createdAt: "2024-01-10",
};

const SEED_USERS = [
  { id: 1, name: "Admin User", email: "admin@store.com", password: "admin123", role: "owner", createdAt: "2024-01-10", active: true },
  { id: 2, name: "Jane Doe", email: "jane@store.com", password: "user123", role: "cashier", createdAt: "2024-02-14", active: true },
  { id: 3, name: "Mark Lee", email: "mark@store.com", password: "user123", role: "manager", createdAt: "2024-03-05", active: true },
  { id: 4, name: "Priya Shah", email: "priya@store.com", password: "user123", role: "viewer", createdAt: "2024-04-20", active: false },
];

const createSeedTransactions = (users, items) => {
  const txns = [];
  const now = new Date();
  let id = 1;
  const salesUsers = users.filter((user) => ["owner", "manager", "cashier"].includes(user.role));

  for (let d = 29; d >= 0; d -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const count = Math.floor(Math.random() * 5) + 1;

    for (let i = 0; i < count; i += 1) {
      const item = items[Math.floor(Math.random() * items.length)];
      const qty = Math.floor(Math.random() * 4) + 1;
      const user = salesUsers[Math.floor(Math.random() * salesUsers.length)];

      txns.push({
        id: id++,
        instanceId: DEFAULT_INSTANCE_ID,
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        qty,
        amount: item.amount * qty,
        unitAmount: item.amount,
        unitCost: item.purchaseCost,
        costAmount: item.purchaseCost * qty,
        profit: (item.amount - item.purchaseCost) * qty,
        category: item.category,
        supplier: item.supplier,
        userId: user.id,
        userName: user.name,
        date: date.toISOString().split("T")[0],
        time: `${String(8 + Math.floor(Math.random() * 10)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
      });
    }
  }

  return txns;
};

const createSeedUsers = async () => Promise.all(
  SEED_USERS.map(async (user) => {
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash(user.password, salt);
    return { ...user, password, instanceId: DEFAULT_INSTANCE_ID };
  })
);

export const createSeedData = async () => {
  const users = await createSeedUsers();

  return {
    instances: [{ ...DEFAULT_INSTANCE, businessProfile: { ...DEFAULT_BUSINESS_PROFILE } }],
    businessProfile: { ...DEFAULT_BUSINESS_PROFILE },
    items: SEED_ITEMS.map(item => ({ ...item, instanceId: DEFAULT_INSTANCE_ID })),
    users,
    txns: createSeedTransactions(users, SEED_ITEMS),
    notifications: SEED_NOTIFICATIONS.map(notification => ({ ...notification, instanceId: DEFAULT_INSTANCE_ID })),
    refreshTokens: [],
    auditLogs: [],
    stockAdjustments: [],
  };
};
