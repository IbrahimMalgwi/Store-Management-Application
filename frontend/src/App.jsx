import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import { api } from "./services/api";
import { icons as I } from "./constants/icons";
import { formatCurrency as fmt, formatNumber as fmtNum } from "./utils/formatters";
import { BarChart } from "./components/charts/BarChart";
import { LineChart } from "./components/charts/LineChart";
import { HorizontalRankingChart } from "./components/charts/HorizontalRankingChart";
import { NotificationPanel } from "./components/notifications/NotificationPanel";
import { Modal } from "./components/ui/Modal";

const DEFAULT_BUSINESS_PROFILE = {
  businessName: "StockOS",
  address: "Store Management Platform",
  phone: "",
  email: "",
};

const DEFAULT_LICENSE = {
  mode: "standalone",
  plan: "standalone",
  status: "active",
  seats: 10,
  expiresAt: "",
  licenseKey: "LOCAL-STANDALONE",
};

const DEFAULT_RECEIPT_SETTINGS = {
  prefix: "SALE",
  separator: "-",
  nextNumber: 1,
  minDigits: 4,
  preview: "SALE-0001",
};

const RECEIPT_FOOTER = "Store Management Application powered by Ganzy-Malgwi Technologies, 08152546005, ganzymalgwitechnologies@gmail.com.";

const LICENSE_LABELS = {
  standalone: "Standalone",
  saas: "SaaS",
  trial: "Trial",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
  active: "Active",
  trialing: "Trialing",
  past_due: "Past Due",
  expired: "Expired",
  suspended: "Suspended",
};

const LICENSE_STATUS_CLASS = {
  active: "green",
  trialing: "blue",
  past_due: "orange",
  expired: "red",
  suspended: "gray",
};

const ROLE_LABELS = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  viewer: "Viewer",
};

const ROLE_PERMISSIONS = {
  owner: ["viewReports", "viewInventory", "manageInventory", "viewAllTransactions", "sell", "printReceipts", "reprintReceipts", "manageUsers", "manageSettings", "manageData", "viewCustomers", "createCustomers", "manageCustomers", "manageRefunds"],
  manager: ["viewReports", "viewInventory", "manageInventory", "viewAllTransactions", "sell", "printReceipts", "reprintReceipts", "viewCustomers", "createCustomers", "manageCustomers", "manageRefunds"],
  cashier: ["viewOwnReports", "viewInventory", "sell", "printReceipts", "viewCustomers", "createCustomers"],
  viewer: ["viewReports", "viewInventory", "viewAllTransactions"],
};

const hasPermission = (user, permission) => ROLE_PERMISSIONS[user?.role]?.includes(permission) || false;

const getTxnQty = (txn) => Number(txn.qty || 0) - Number(txn.refundedQty || 0);
const getTxnRevenue = (txn) => Number(txn.amount || 0) - Number(txn.refundedAmount || 0);
const getTxnCost = (txn) => Number(txn.costAmount ?? (Number(txn.unitCost || 0) * Number(txn.qty || 0))) - Number(txn.refundedCostAmount || 0);
const getTxnProfit = (txn) => Number(txn.profit ?? Number(txn.amount || 0) - Number(txn.costAmount || 0)) - Number(txn.refundedProfit || 0);
const getItemThreshold = (item) => {
  const threshold = Number.parseInt(item?.reorderThreshold, 10);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : 5;
};

const formatReceiptPreview = (settings = DEFAULT_RECEIPT_SETTINGS) => {
  const prefix = String(settings.prefix || DEFAULT_RECEIPT_SETTINGS.prefix).toUpperCase();
  const separator = settings.separator ?? DEFAULT_RECEIPT_SETTINGS.separator;
  const nextNumber = Math.max(1, Number.parseInt(settings.nextNumber, 10) || DEFAULT_RECEIPT_SETTINGS.nextNumber);
  const minDigits = Math.min(12, Math.max(1, Number.parseInt(settings.minDigits, 10) || DEFAULT_RECEIPT_SETTINGS.minDigits));
  return `${prefix}${separator}${String(nextNumber).padStart(minDigits, "0")}`;
};

const getReceiptId = (txn) => txn.saleId || String(txn.id);

const buildReceipts = (txns) => {
  const grouped = txns.reduce((acc, txn) => {
    const id = getReceiptId(txn);
    if (!acc[id]) acc[id] = [];
    acc[id].push(txn);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([id, items]) => {
      const first = items[0];
      return {
        id,
        receiptNo: first.receiptNo || id,
        date: first.date,
        time: first.time,
        userId: first.userId,
        userName: first.userName,
        customer: first.customer || { name: "Walk-in Customer", address: "Not recorded", contact: "Not recorded" },
        businessProfile: first.businessProfile || DEFAULT_BUSINESS_PROFILE,
        items,
        itemCount: items.length,
        qty: items.reduce((sum, item) => sum + item.qty, 0),
        refundedQty: items.reduce((sum, item) => sum + Number(item.refundedQty || 0), 0),
        total: items.reduce((sum, item) => sum + item.amount, 0),
        refundedAmount: items.reduce((sum, item) => sum + Number(item.refundedAmount || 0), 0),
        netTotal: items.reduce((sum, item) => sum + getTxnRevenue(item), 0),
        receiptPrinted: items.some(item => item.receiptPrinted),
        receiptPrintedAt: items.find(item => item.receiptPrintedAt)?.receiptPrintedAt || null,
      };
    })
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
};

const receiptFromTransactions = (txns) => buildReceipts(txns)[0];

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const renderReceiptCopy = (receipt, copyLabel) => `
  <section class="receipt-copy">
    <div class="receipt-top">
      <div>
        <h1>${escapeHtml(receipt.businessProfile?.businessName || DEFAULT_BUSINESS_PROFILE.businessName)}</h1>
        <p>${escapeHtml(receipt.businessProfile?.address || DEFAULT_BUSINESS_PROFILE.address)}</p>
        <p>${escapeHtml(receipt.businessProfile?.phone || "")}${receipt.businessProfile?.phone && receipt.businessProfile?.email ? " | " : ""}${escapeHtml(receipt.businessProfile?.email || "")}</p>
      </div>
      <strong>${escapeHtml(copyLabel)}</strong>
    </div>
    <div class="receipt-meta">
      <span>Receipt No: <strong>${escapeHtml(receipt.receiptNo)}</strong></span>
      <span>Date: <strong>${escapeHtml(receipt.date)} ${escapeHtml(receipt.time)}</strong></span>
      <span>Sold By: <strong>${escapeHtml(receipt.userName)}</strong></span>
    </div>
    <div class="customer-block">
      <h2>Customer Details</h2>
      <p><strong>Name:</strong> ${escapeHtml(receipt.customer?.name || "Not recorded")}</p>
      <p><strong>Address:</strong> ${escapeHtml(receipt.customer?.address || "Not recorded")}</p>
      <p><strong>Contact:</strong> ${escapeHtml(receipt.customer?.contact || "Not recorded")}</p>
    </div>
    <table>
      <thead>
        <tr><th>Item</th><th>SKU</th><th>Qty</th><th>Unit</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${receipt.items.map(item => `
          <tr>
            <td>${escapeHtml(item.itemName)}</td>
            <td>${escapeHtml(item.sku)}</td>
            <td>${escapeHtml(item.qty)}</td>
            <td>${escapeHtml(fmt(item.unitAmount ?? item.amount / item.qty))}</td>
            <td>${escapeHtml(fmt(item.amount))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="receipt-total">
      <span>Total</span>
      <strong>${escapeHtml(fmt(receipt.total))}</strong>
    </div>
    ${receipt.refundedAmount ? `
      <div class="receipt-total">
        <span>Refunded</span>
        <strong>-${escapeHtml(fmt(receipt.refundedAmount))}</strong>
      </div>
      <div class="receipt-total">
        <span>Net Total</span>
        <strong>${escapeHtml(fmt(receipt.netTotal))}</strong>
      </div>
    ` : ""}
    <footer>${escapeHtml(RECEIPT_FOOTER)}</footer>
  </section>
`;

const printReceiptDocument = (receipt, copyType, printWindow) => {
  const copyLabels = copyType === "customer"
    ? ["Customer Copy"]
    : copyType === "record"
      ? ["Record Copy"]
      : ["Customer Copy", "Record Copy"];

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Receipt ${escapeHtml(receipt.receiptNo)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; }
          .receipt-copy { max-width: 760px; margin: 0 auto 28px; padding: 22px; border: 1px solid #111827; page-break-after: always; }
          .receipt-copy:last-child { page-break-after: auto; }
          .receipt-top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 16px; }
          h1 { margin: 0; font-size: 24px; }
          h2 { font-size: 14px; margin: 0 0 8px; }
          p { margin: 3px 0; }
          .receipt-top p, .receipt-meta, .customer-block p { font-size: 12px; }
          .receipt-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
          .customer-block { padding: 12px; border: 1px solid #d1d5db; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border-bottom: 1px solid #d1d5db; padding: 9px 6px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; text-transform: uppercase; font-size: 10px; letter-spacing: .06em; }
          td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align: right; }
          th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
          .receipt-total { display: flex; justify-content: flex-end; gap: 30px; margin-top: 18px; font-size: 16px; }
          footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #d1d5db; text-align: center; font-size: 11px; color: #4b5563; }
          @media print { body { padding: 0; } .receipt-copy { border: none; } }
        </style>
      </head>
      <body>${copyLabels.map(label => renderReceiptCopy(receipt, label)).join("")}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
};

const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some(cell => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some(cell => cell.trim() !== "")) rows.push(row);
  return rows;
};

const normalizeHeader = (header) => String(header || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const mapStockRows = (rows) => {
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const getIndex = (...names) => names.map(normalizeHeader).map(name => headers.indexOf(name)).find(index => index >= 0);
  const skuIndex = getIndex("sku", "itemsku");
  const nameIndex = getIndex("name", "item", "itemname", "product");
  const qtyIndex = getIndex("qty", "quantity", "stock", "stockqty");
  const amountIndex = getIndex("amount", "price", "unitprice", "sellingprice", "saleprice");
  const purchaseCostIndex = getIndex("purchasecost", "cost", "unitcost", "buyingprice");
  const reorderThresholdIndex = getIndex("reorderthreshold", "threshold", "reorderlevel", "minimumstock");
  const categoryIndex = getIndex("category", "productcategory");
  const supplierIndex = getIndex("supplier", "vendor");
  const descriptionIndex = getIndex("description", "desc", "details");

  return rows.slice(1).map(row => ({
    sku: row[skuIndex] ?? "",
    name: row[nameIndex] ?? "",
    qty: row[qtyIndex] ?? "",
    amount: row[amountIndex] ?? "",
    purchaseCost: purchaseCostIndex >= 0 ? row[purchaseCostIndex] ?? "" : "",
    reorderThreshold: reorderThresholdIndex >= 0 ? row[reorderThresholdIndex] ?? 5 : 5,
    category: categoryIndex >= 0 ? row[categoryIndex] ?? "" : "",
    supplier: supplierIndex >= 0 ? row[supplierIndex] ?? "" : "",
    description: descriptionIndex >= 0 ? row[descriptionIndex] ?? "" : "",
  })).filter(item => item.sku || item.name || item.qty || item.amount || item.purchaseCost);
};

const readStockFile = async (file) => {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "xlsx") {
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    const rows = await readXlsxFile(file);
    return mapStockRows(rows);
  }

  const text = await file.text();
  return mapStockRows(parseCSV(text));
};

const csvEscape = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const downloadCSV = (filename, rows) => {
  const csv = rows.map(row => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const todayString = () => new Date().toISOString().split("T")[0];

const getStartDateForPeriod = (period) => {
  const date = new Date();
  if (period === "daily") return todayString();
  if (period === "weekly") date.setDate(date.getDate() - 6);
  if (period === "monthly") date.setMonth(date.getMonth() - 1);
  if (period === "yearly") date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split("T")[0];
};

const PERIOD_OPTIONS = ["daily", "weekly", "monthly", "yearly", "custom"];

const toTitle = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const inDateRange = (txn, startDate, endDate) => txn.date >= startDate && txn.date <= endDate;

const getRangeLabel = (period, startDate, endDate) =>
  period === "custom" ? `${startDate} to ${endDate}` : `${toTitle(period)} period`;

const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

const getDefaultDashboardRange = (period = "weekly") => ({
  period,
  startDate: getStartDateForPeriod(period),
  endDate: todayString(),
});

const readDashboardRange = (storageKey, fallbackPeriod = "weekly") => {
  const fallback = getDefaultDashboardRange(fallbackPeriod);

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || !PERIOD_OPTIONS.includes(saved.period)) return fallback;
    if (saved.period !== "custom") return getDefaultDashboardRange(saved.period);
    if (!isDateString(saved.startDate) || !isDateString(saved.endDate) || saved.startDate > saved.endDate) return fallback;
    return saved;
  } catch {
    return fallback;
  }
};

const getDashboardRangeStorageKey = (view, user) =>
  `stockos.dashboard.range.${user?.instanceId || "default"}.${user?.id || "anonymous"}.${view}`;

function usePersistedDashboardRange(storageKey, fallbackPeriod = "weekly") {
  const [range, setRange] = useState(() => readDashboardRange(storageKey, fallbackPeriod));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(range));
    } catch {
      // Dashboard filtering should still work when browser storage is unavailable.
    }
  }, [range, storageKey]);

  return {
    ...range,
    setPeriod: period => setRange(current => ({ ...current, period })),
    setStartDate: startDate => setRange(current => ({ ...current, startDate })),
    setEndDate: endDate => setRange(current => ({ ...current, endDate })),
  };
}

const getComparisonRanges = () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  return {
    today: { start: today.toISOString().split("T")[0], end: today.toISOString().split("T")[0] },
    yesterday: { start: yesterday.toISOString().split("T")[0], end: yesterday.toISOString().split("T")[0] },
    currentMonth: {
      start: new Date(Date.UTC(year, month, 1)).toISOString().split("T")[0],
      end: today.toISOString().split("T")[0],
    },
    previousMonth: {
      start: new Date(Date.UTC(year, month - 1, 1)).toISOString().split("T")[0],
      end: new Date(Date.UTC(year, month, 0)).toISOString().split("T")[0],
    },
  };
};

const summarizeTransactions = (txns, range) => txns
  .filter(txn => inDateRange(txn, range.start, range.end))
  .reduce((summary, txn) => ({
    revenue: summary.revenue + getTxnRevenue(txn),
    profit: summary.profit + getTxnProfit(txn),
    qty: summary.qty + getTxnQty(txn),
  }), { revenue: 0, profit: 0, qty: 0 });

const getPercentageChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const formatPercentageChange = (change) => {
  if (change === null) return "New";
  return `${change >= 0 ? "+" : ""}${Math.round(change)}%`;
};

function PeriodRangeControl({ period, setPeriod, startDate, setStartDate, endDate, setEndDate }) {
  const syncPeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== "custom") {
      setStartDate(getStartDateForPeriod(nextPeriod));
      setEndDate(todayString());
    }
  };

  return (
    <div className="dashboard-range">
      <div className="period-tabs">
        {PERIOD_OPTIONS.map(p => (
          <button key={p} className={`period-tab ${period === p ? "active" : ""}`} onClick={() => syncPeriod(p)}>
            {toTitle(p)}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="date-range-inputs">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span>to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      )}
    </div>
  );
}

function ComparisonCard({ title, subtitle, current, previous }) {
  const metrics = [
    { label: "Revenue", current: current.revenue, previous: previous.revenue, format: fmt },
    { label: "Profit", current: current.profit, previous: previous.profit, format: fmt },
    { label: "Units", current: current.qty, previous: previous.qty, format: fmtNum },
  ];

  return (
    <div className="comparison-card">
      <div className="comparison-card-heading">
        <div>
          <h4>{title}</h4>
          <p>{subtitle}</p>
        </div>
        <div className="comparison-icon">{I.chart}</div>
      </div>
      <div className="comparison-list">
        {metrics.map(metric => {
          const change = getPercentageChange(metric.current, metric.previous);
          const tone = change === null ? "blue" : change >= 0 ? "green" : "red";
          return (
            <div className="comparison-row" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.format(metric.current)}</strong>
              <small>Previous {metric.format(metric.previous)}</small>
              <span className={`badge-pill ${tone}`}>{formatPercentageChange(change)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ──────────────────────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@store.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setError("");
      await login(email, password);
    } catch (err) {
      setError(err.message || "Invalid credentials.");
    }
  };

  const fillDemo = (type) => {
    setError("");
    if (type === "owner") {
      setEmail("admin@store.com");
      setPassword("admin123");
    } else {
      setEmail("jane@store.com");
      setPassword("user123");
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span>SO</span></div>
          <div>
            <h1>Stock<span>OS</span></h1>
            <p>Store Management Platform</p>
          </div>
        </div>
        <div className="login-tabs">
          <button className="login-tab active" onClick={() => fillDemo("owner")}>Owner Demo</button>
          <button className="login-tab" onClick={() => fillDemo("cashier")}>Cashier Demo</button>
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "11px" }} onClick={handleLogin}>
          Sign In →
        </button>
        <p style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", marginTop: 16, textAlign: "center" }}>
          Owner: admin@store.com / admin123 &nbsp;|&nbsp; Cashier: jane@store.com / user123
        </p>
      </div>
    </div>
  );
}

// ─── ADMIN: Dashboard ────────────────────────────────────────────────────────
function AdminDashboard({ currentUser, items, users, txns }) {
  const { period, setPeriod, startDate, setStartDate, endDate, setEndDate } =
    usePersistedDashboardRange(getDashboardRangeStorageKey("management", currentUser));
  const rangeLabel = getRangeLabel(period, startDate, endDate);
  const filtered = txns.filter(t => inDateRange(t, startDate, endDate));
  const totalRevenue = filtered.reduce((s, t) => s + getTxnRevenue(t), 0);
  const totalProfit = filtered.reduce((s, t) => s + getTxnProfit(t), 0);
  const totalSold = filtered.reduce((s, t) => s + getTxnQty(t), 0);
  const lowStock = items.filter(i => i.qty <= getItemThreshold(i)).length;
  const activeUsers = users.length ? users.filter(u => u.active).length : "—";
  const comparisonRanges = getComparisonRanges();
  const todayMetrics = summarizeTransactions(txns, comparisonRanges.today);
  const yesterdayMetrics = summarizeTransactions(txns, comparisonRanges.yesterday);
  const currentMonthMetrics = summarizeTransactions(txns, comparisonRanges.currentMonth);
  const previousMonthMetrics = summarizeTransactions(txns, comparisonRanges.previousMonth);

  const itemRevenue = {};
  filtered.forEach(t => {
    itemRevenue[t.itemId] = itemRevenue[t.itemId] || { name: t.itemName, sku: t.sku, category: t.category || "General", supplier: t.supplier || "", qty: 0, revenue: 0, profit: 0 };
    itemRevenue[t.itemId].qty += getTxnQty(t);
    itemRevenue[t.itemId].revenue += getTxnRevenue(t);
    itemRevenue[t.itemId].profit += getTxnProfit(t);
  });
  const itemRevenueRows = Object.values(itemRevenue).sort((a, b) => b.revenue - a.revenue);
  const best = itemRevenueRows.slice(0, 5);

  const userTxns = {};
  filtered.forEach(t => {
    const user = users.find(item => item.id === t.userId);
    userTxns[t.userId] = userTxns[t.userId] || { id: t.userId, count: 0, qty: 0, amount: 0, profit: 0, name: t.userName, email: user?.email || "" };
    userTxns[t.userId].count++;
    userTxns[t.userId].qty += getTxnQty(t);
    userTxns[t.userId].amount += getTxnRevenue(t);
    userTxns[t.userId].profit += getTxnProfit(t);
  });
  const userRevenueRows = Object.values(userTxns).sort((a, b) => b.amount - a.amount);
  const topProductChartData = best.map(item => ({ id: item.sku, label: item.name, meta: item.sku, value: item.revenue }));
  const topUserChartData = userRevenueRows.slice(0, 5).map(user => ({ id: user.id, label: user.name, meta: `${user.count} sales`, value: user.amount }));
  const exportRange = `${period}-${startDate}-to-${endDate}`;
  const downloadItemRevenue = () => downloadCSV(`item-revenue-${exportRange}.csv`, [
    ["From", "To", "Item", "SKU", "Category", "Supplier", "Net Units Sold", "Net Revenue", "Net Profit"],
    ...itemRevenueRows.map(item => [
      startDate,
      endDate,
      item.name,
      item.sku,
      item.category,
      item.supplier || "Unassigned",
      item.qty,
      item.revenue,
      item.profit,
    ]),
  ]);
  const downloadUserRevenue = () => downloadCSV(`user-revenue-${exportRange}.csv`, [
    ["From", "To", "User ID", "User", "Email", "Transactions", "Net Units Sold", "Net Revenue", "Net Profit"],
    ...userRevenueRows.map(user => [
      startDate,
      endDate,
      user.id,
      user.name,
      user.email,
      user.count,
      user.qty,
      user.amount,
      user.profit,
    ]),
  ]);

  const categoryRows = Object.values(filtered.reduce((acc, txn) => {
    const key = txn.category || "General";
    acc[key] = acc[key] || { name: key, revenue: 0, profit: 0, qty: 0 };
    acc[key].revenue += getTxnRevenue(txn);
    acc[key].profit += getTxnProfit(txn);
    acc[key].qty += getTxnQty(txn);
    return acc;
  }, {})).sort((a, b) => b.profit - a.profit);

  const supplierRows = Object.values(filtered.reduce((acc, txn) => {
    const key = txn.supplier || "Unassigned";
    acc[key] = acc[key] || { name: key, revenue: 0, profit: 0, qty: 0 };
    acc[key].revenue += getTxnRevenue(txn);
    acc[key].profit += getTxnProfit(txn);
    acc[key].qty += getTxnQty(txn);
    return acc;
  }, {})).sort((a, b) => b.profit - a.profit);

  const now = new Date();
  const getDays = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - (n - 1 - i)); return d.toISOString().split("T")[0]; });
  const days7 = getDays(7);
  const barData = days7.map(day => ({
    l: new Date(day).toLocaleDateString("en", { weekday: "short" }).slice(0, 2),
    v: txns.filter(t => t.date === day).reduce((s, t) => s + getTxnRevenue(t), 0),
  }));
  const lineData = days7.map(day => txns.filter(t => t.date === day).reduce((s, t) => s + getTxnQty(t), 0));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Analytics Dashboard</h2>
          <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>Store performance overview</p>
        </div>
        <PeriodRangeControl period={period} setPeriod={setPeriod} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
      </div>

      <div className="stat-grid">
        <div className="stat-card green">
          <div className="stat-label">Revenue</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{fmt(totalRevenue)}</div>
          <div className="stat-sub">{rangeLabel}</div>
          <div className="stat-icon">{I.money}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Profit</div>
          <div className="stat-value" style={{ color: "var(--accent2)" }}>{fmt(totalProfit)}</div>
          <div className="stat-sub">{totalRevenue > 0 ? `${Math.round((totalProfit / totalRevenue) * 100)}% margin` : rangeLabel}</div>
          <div className="stat-icon">{I.chart}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Units Sold</div>
          <div className="stat-value" style={{ color: "var(--accent3)" }}>{fmtNum(totalSold)}</div>
          <div className="stat-sub">{filtered.length} transactions</div>
          <div className="stat-icon">{I.pkg}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Active Users</div>
          <div className="stat-value" style={{ color: "var(--accent4)" }}>{activeUsers}</div>
          <div className="stat-sub">{users.length ? `${users.length} total users` : "owner-only detail"}</div>
          <div className="stat-icon">{I.users}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Low Stock</div>
          <div className="stat-value" style={{ color: "var(--danger)" }}>{lowStock}</div>
          <div className="stat-sub">items need restock</div>
          <div className="stat-icon">{I.warn}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Total SKUs</div>
          <div className="stat-value" style={{ color: "var(--accent2)" }}>{items.length}</div>
          <div className="stat-sub">{items.reduce((s, i) => s + i.qty, 0)} units in stock</div>
          <div className="stat-icon">{I.items}</div>
        </div>
      </div>

      <div className="comparison-grid">
        <ComparisonCard
          title="Today vs Yesterday"
          subtitle="Net performance for the current day"
          current={todayMetrics}
          previous={yesterdayMetrics}
        />
        <ComparisonCard
          title="This Month vs Last Month"
          subtitle="Month-to-date compared with the previous month"
          current={currentMonthMetrics}
          previous={previousMonthMetrics}
        />
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h4>Revenue (7 days)</h4>
          <p>Daily revenue trend</p>
          <BarChart data={barData} color="var(--accent)" />
        </div>
        <div className="chart-card">
          <h4>Units Sold (7 days)</h4>
          <p>Daily unit movement</p>
          <LineChart data={lineData} color="var(--accent2)" />
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h4>Top Products</h4>
          <p>Net revenue leaders - {rangeLabel}</p>
          <HorizontalRankingChart data={topProductChartData} formatter={fmt} />
        </div>
        <div className="chart-card">
          <h4>Top Users</h4>
          <p>Net revenue contribution - {rangeLabel}</p>
          <HorizontalRankingChart data={topUserChartData} formatter={fmt} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="table-card">
          <div className="table-header"><h3>Top Items by Revenue</h3></div>
          <table>
            <thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Revenue</th><th>Profit</th></tr></thead>
            <tbody>
              {best.length === 0 ? <tr><td colSpan={5}><div className="empty">No data</div></td></tr> :
                best.map((b, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--text)" }}>{b.name}</td>
                    <td><span className="badge-pill gray">{b.sku}</span></td>
                    <td><span className="badge-pill green">{b.qty}</span></td>
                    <td style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(b.revenue)}</td>
                    <td style={{ color: "var(--accent2)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(b.profit)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="table-card">
          <div className="table-header">
            <h3>Revenue by User</h3>
            <button className="btn btn-sm btn-secondary" disabled={userRevenueRows.length === 0} onClick={downloadUserRevenue}>Export CSV</button>
          </div>
          <table>
            <thead><tr><th>User</th><th>Transactions</th><th>Qty</th><th>Revenue</th><th>Profit</th></tr></thead>
            <tbody>
              {userRevenueRows.length === 0 ? <tr><td colSpan={5}><div className="empty">No data</div></td></tr> :
                userRevenueRows.map((u, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--text)" }}>{u.name}</td>
                    <td><span className="badge-pill blue">{u.count}</span></td>
                    <td><span className="badge-pill green">{u.qty}</span></td>
                    <td style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(u.amount)}</td>
                    <td style={{ color: "var(--accent2)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(u.profit)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card" style={{ marginTop: 14 }}>
        <div className="table-header">
          <h3>All Item Profit</h3>
          <button className="btn btn-sm btn-secondary" disabled={itemRevenueRows.length === 0} onClick={downloadItemRevenue}>Export CSV</button>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Category</th><th>Supplier</th><th>Units Sold</th><th>Revenue</th><th>Profit</th></tr></thead>
          <tbody>
            {itemRevenueRows.length === 0 ? <tr><td colSpan={6}><div className="empty">No item revenue in this range</div></td></tr> :
              itemRevenueRows.map((item, index) => (
                <tr key={`${item.sku}-${index}`}>
                  <td style={{ color: "var(--text)" }}>{item.name}</td>
                  <td><span className="badge-pill purple">{item.category}</span></td>
                  <td>{item.supplier || "Unassigned"}</td>
                  <td><span className="badge-pill blue">{item.qty}</span></td>
                  <td style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(item.revenue)}</td>
                  <td style={{ color: "var(--accent2)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(item.profit)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div className="table-card">
          <div className="table-header"><h3>Profit by Category</h3></div>
          <table>
            <thead><tr><th>Category</th><th>Qty</th><th>Revenue</th><th>Profit</th></tr></thead>
            <tbody>
              {categoryRows.length === 0 ? <tr><td colSpan={4}><div className="empty">No data</div></td></tr> :
                categoryRows.map(row => (
                  <tr key={row.name}>
                    <td><span className="badge-pill purple">{row.name}</span></td>
                    <td>{row.qty}</td>
                    <td style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(row.revenue)}</td>
                    <td style={{ color: "var(--accent2)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(row.profit)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="table-card">
          <div className="table-header"><h3>Profit by Supplier</h3></div>
          <table>
            <thead><tr><th>Supplier</th><th>Qty</th><th>Revenue</th><th>Profit</th></tr></thead>
            <tbody>
              {supplierRows.length === 0 ? <tr><td colSpan={4}><div className="empty">No data</div></td></tr> :
                supplierRows.map(row => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.qty}</td>
                    <td style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(row.revenue)}</td>
                    <td style={{ color: "var(--accent2)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(row.profit)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card" style={{ marginTop: 14 }}>
        <div className="table-header"><h3>Stock Levels</h3></div>
        <table>
          <thead><tr><th>SKU</th><th>Item</th><th>Stock</th><th>Level</th></tr></thead>
          <tbody>
            {items.map(item => {
              const pct = Math.min(100, (item.qty / 50) * 100);
              const threshold = getItemThreshold(item);
              const color = item.qty <= threshold ? "var(--danger)" : item.qty <= threshold * 2 ? "var(--warn)" : "var(--accent)";
              return (
                <tr key={item.id}>
                  <td><span className="badge-pill gray">{item.sku}</span></td>
                  <td style={{ color: "var(--text)" }}>{item.name}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{item.qty} units</td>
                  <td style={{ width: 140 }}>
                    <div className="progress">
                      <div className="progress-bar" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── ADMIN: Inventory ────────────────────────────────────────────────────────
function AdminInventory({ items, stockAdjustments = [], onAdd, onEdit, onDelete, onAdjust, onBulkImport, readOnly = false }) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "add" | "edit"
  const [importModal, setImportModal] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ mode: "increase", quantity: "", reason: "" });
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [form, setForm] = useState({ sku: "", name: "", qty: "", reorderThreshold: 5, amount: "", purchaseCost: "", category: "General", supplier: "", description: "" });
  const [editId, setEditId] = useState(null);

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase()) ||
    String(i.category || "").toLowerCase().includes(search.toLowerCase()) ||
    String(i.supplier || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm({ sku: `SKU-00${items.length + 1}`, name: "", qty: "", reorderThreshold: 5, amount: "", purchaseCost: "", category: "General", supplier: "", description: "" }); setModal("add"); };
  const openEdit = (item) => { setForm({ sku: item.sku, name: item.name, qty: item.qty, reorderThreshold: getItemThreshold(item), amount: item.amount, purchaseCost: item.purchaseCost || 0, category: item.category || "General", supplier: item.supplier || "", description: item.description }); setEditId(item.id); setModal("edit"); };
  
  const save = async () => {
    if (!form.sku || !form.name || form.qty === "" || form.reorderThreshold === "" || form.amount === "" || form.purchaseCost === "") return;
    try {
      if (modal === "add") {
        await onAdd(form);
      } else {
        await onEdit(editId, form);
      }
      setModal(null);
    } catch (err) {
      alert(err.message || "Error saving inventory item");
    }
  };

  const del = async (id) => {
    if (confirm("Delete this item?")) {
      try {
        await onDelete(id);
      } catch (err) {
        alert(err.message || "Error deleting item");
      }
    }
  };

  const openAdjust = (item) => {
    setAdjustItem(item);
    setAdjustForm({ mode: "increase", quantity: "", reason: "" });
  };

  const submitAdjustment = async () => {
    if (!adjustItem || !adjustForm.quantity) return;
    try {
      await onAdjust(adjustItem.id, adjustForm);
      setAdjustItem(null);
    } catch (err) {
      alert(err.message || "Error adjusting stock");
    }
  };

  const renderField = ({ label, field, type = "text", placeholder }) => (
    <div className="form-group">
      <label>{label}</label>
      <input type={type} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  const previewImport = async (file) => {
    setImportFile(file);
    if (!file) {
      setImportPreview([]);
      return;
    }

    try {
      const rows = await readStockFile(file);
      setImportPreview(rows);
    } catch (err) {
      setImportPreview([]);
      alert(err.message || "Unable to read stock file");
    }
  };

  const submitImport = async () => {
    if (importPreview.length === 0) return;
    try {
      const result = await onBulkImport(importPreview);
      alert(`Import completed. Created: ${result.created}. Updated: ${result.updated}.`);
      setImportFile(null);
      setImportPreview([]);
      setImportModal(false);
    } catch (err) {
      alert(err.message || "Error importing stock");
    }
  };

  return (
    <>
      <div className="section-header">
        <h2>Inventory</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="search-wrap">
            <span className="search-icon">{I.search}</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" style={{ width: 200 }} />
          </div>
          {!readOnly && <button className="btn btn-secondary" onClick={() => setImportModal(true)}>Import Stock</button>}
          {!readOnly && <button className="btn btn-primary" onClick={openAdd}>{I.add} Add Item</button>}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Supplier</th><th>Qty</th><th>Reorder At</th><th>Status</th><th>Cost</th><th>Price</th><th>Margin</th><th>Sold</th>{!readOnly && <th>Actions</th>}</tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={readOnly ? 11 : 12}><div className="empty">No items found</div></td></tr> :
              filtered.map(item => {
                const threshold = getItemThreshold(item);
                const isLow = item.qty <= threshold;
                return <tr key={item.id}>
                  <td><span className="badge-pill gray">{item.sku}</span></td>
                  <td style={{ color: "var(--text)", fontWeight: 600 }}>{item.name}</td>
                  <td><span className="badge-pill purple">{item.category || "General"}</span></td>
                  <td>{item.supplier || "Unassigned"}</td>
                  <td>
                    <span className={`badge-pill ${isLow ? "red" : item.qty <= threshold * 2 ? "orange" : "green"}`}>{item.qty}</span>
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{threshold}</td>
                  <td><span className={`badge-pill ${isLow ? "red" : "green"}`}>{isLow ? "Reorder" : "Stocked"}</span></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(item.purchaseCost || 0)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{fmt(item.amount)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent2)" }}>{fmt((item.amount || 0) - (item.purchaseCost || 0))}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{item.sold}</td>
                  {!readOnly && <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>{I.edit}</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => openAdjust(item)}>Adjust</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(item.id)}>{I.del}</button>
                    </div>
                  </td>}
                </tr>;
              })}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "add" ? "Add Item" : "Edit Item"} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save Item</button></>}>
          <div className="form-row">{renderField({ label: "SKU", field: "sku", placeholder: "SKU-001" })}{renderField({ label: "Name", field: "name", placeholder: "Item name" })}</div>
          <div className="form-row">{renderField({ label: "Category", field: "category", placeholder: "Accessories" })}{renderField({ label: "Supplier", field: "supplier", placeholder: "Supplier name" })}</div>
          <div className="form-row">{renderField({ label: "Quantity", field: "qty", type: "number", placeholder: "0" })}{renderField({ label: "Reorder Threshold", field: "reorderThreshold", type: "number", placeholder: "5" })}</div>
          <div className="form-row">{renderField({ label: "Purchase Cost (₦)", field: "purchaseCost", type: "number", placeholder: "0.00" })}{renderField({ label: "Selling Price (₦)", field: "amount", type: "number", placeholder: "0.00" })}</div>
          <div className="form-group"><label>Unit Profit</label><input value={fmt((Number(form.amount) || 0) - (Number(form.purchaseCost) || 0))} readOnly /></div>
          {renderField({ label: "Description", field: "description", placeholder: "Item description" })}
        </Modal>
      )}

      {adjustItem && (
        <Modal title={`Adjust Stock: ${adjustItem.name}`} onClose={() => setAdjustItem(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setAdjustItem(null)}>Cancel</button><button className="btn btn-primary" onClick={submitAdjustment}>Save Adjustment</button></>}>
          <div className="stock-adjust-summary">
            <div><span>Current Stock</span><strong>{adjustItem.qty}</strong></div>
            <div><span>SKU</span><strong>{adjustItem.sku}</strong></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Adjustment Type</label>
              <select value={adjustForm.mode} onChange={e => setAdjustForm(f => ({ ...f, mode: e.target.value }))}>
                <option value="increase">Increase Stock</option>
                <option value="decrease">Decrease Stock</option>
                <option value="set">Set Exact Stock</option>
              </select>
            </div>
            <div className="form-group">
              <label>{adjustForm.mode === "set" ? "New Quantity" : "Quantity"}</label>
              <input type="number" min="1" value={adjustForm.quantity} onChange={e => setAdjustForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div className="form-group">
            <label>Reason</label>
            <textarea value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))} placeholder="Damaged goods, stock count correction, returned stock..." />
          </div>
        </Modal>
      )}

      {!readOnly && (
        <div className="table-card" style={{ marginTop: 14 }}>
          <div className="table-header"><h3>Recent Stock Adjustments</h3></div>
          <table>
            <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Before</th><th>Change</th><th>After</th><th>Reason</th><th>By</th></tr></thead>
            <tbody>
              {stockAdjustments.length === 0 ? <tr><td colSpan={8}><div className="empty">No stock adjustments yet</div></td></tr> :
                stockAdjustments.slice(0, 20).map(adjustment => (
                  <tr key={adjustment.id}>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{new Date(adjustment.createdAt).toLocaleString()}</td>
                    <td><div style={{ color: "var(--text)", fontWeight: 600 }}>{adjustment.itemName}</div><span className="badge-pill gray">{adjustment.sku}</span></td>
                    <td><span className={`badge-pill ${adjustment.change < 0 ? "orange" : "green"}`}>{adjustment.type}</span></td>
                    <td>{adjustment.previousQty}</td>
                    <td style={{ color: adjustment.change < 0 ? "var(--warn)" : "var(--accent)", fontFamily: "var(--mono)" }}>{adjustment.change > 0 ? `+${adjustment.change}` : adjustment.change}</td>
                    <td>{adjustment.newQty}</td>
                    <td>{adjustment.reason || "-"}</td>
                    <td>{adjustment.actorName}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {importModal && (
        <Modal title="Import Bulk Stock" onClose={() => setImportModal(false)}
          footer={<><button className="btn btn-secondary" onClick={() => setImportModal(false)}>Cancel</button><button className="btn btn-primary" onClick={submitImport} disabled={importPreview.length === 0}>Import Stock</button></>}>
          <div className="form-group">
            <label>Excel or CSV File</label>
            <input type="file" accept=".xlsx,.csv" onChange={e => previewImport(e.target.files?.[0])} />
          </div>
          <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14 }}>
            Required columns: SKU, Name, Qty, Price, Purchase Cost. Optional: Reorder Threshold, Category, Supplier, Description. Existing SKUs add imported quantity to current stock.
          </p>
          {importFile && (
            <div className="table-card" style={{ boxShadow: "none", marginBottom: 0 }}>
              <div className="table-header"><h3>{importPreview.length} row(s) ready</h3></div>
              <table>
                <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th>Reorder At</th><th>Cost</th><th>Price</th></tr></thead>
                <tbody>
                  {importPreview.slice(0, 5).map((item, index) => (
                    <tr key={`${item.sku}-${index}`}>
                      <td><span className="badge-pill gray">{item.sku}</span></td>
                      <td>{item.name}</td>
                      <td>{item.qty}</td>
                      <td>{item.reorderThreshold}</td>
                      <td>{item.purchaseCost}</td>
                      <td>{item.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// ─── ADMIN: Users ─────────────────────────────────────────────────────────────
function AdminUsers({ users, currentUser, onAdd, onEdit, onDelete, onToggle, onResetPassword }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "cashier", active: true });
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmPassword: "" });
  const [resetUser, setResetUser] = useState(null);
  const [editId, setEditId] = useState(null);

  const openAdd = () => { setForm({ name: "", email: "", password: "", role: "cashier", active: true }); setModal("add"); };
  const openEdit = (u) => { setForm({ name: u.name, email: u.email, password: u.password, role: u.role, active: u.active }); setEditId(u.id); setModal("edit"); };
  const openReset = (u) => {
    setResetUser(u);
    setPasswordForm({ password: "", confirmPassword: "" });
  };
  
  const save = async () => {
    if (!form.name || !form.email || (!form.password && modal === "add") || !form.role) return;
    try {
      if (modal === "add") {
        await onAdd(form);
      } else {
        await onEdit(editId, form);
      }
      setModal(null);
    } catch (err) {
      alert(err.message || "Error saving user");
    }
  };

  const del = async (id) => {
    if (confirm("Delete this user?")) {
      try {
        await onDelete(id);
      } catch (err) {
        alert(err.message || "Error deleting user");
      }
    }
  };

  const toggle = async (u) => {
    try {
      await onToggle(u.id, u);
    } catch (err) {
      alert(err.message || "Error updating user status");
    }
  };

  const resetPassword = async () => {
    if (!passwordForm.password || !passwordForm.confirmPassword) {
      alert("Password and confirmation are required.");
      return;
    }

    try {
      await onResetPassword(resetUser.id, passwordForm);
      setResetUser(null);
      alert("Password reset successfully.");
    } catch (err) {
      alert(err.message || "Error resetting password");
    }
  };

  return (
    <>
      <div className="section-header">
        <h2>Users</h2>
        <button className="btn btn-primary" onClick={openAdd}>{I.add} Add User</button>
      </div>

      <div className="table-card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ color: "var(--text)", fontWeight: 600 }}>{u.name}</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{u.email}</td>
                <td><span className={`badge-pill ${u.role === "owner" ? "purple" : u.role === "manager" ? "blue" : u.role === "viewer" ? "gray" : "green"}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{u.createdAt}</td>
                <td>
                  <span className={`badge-pill ${u.active ? "green" : "gray"}`} style={{ cursor: "pointer" }} onClick={() => toggle(u)}>
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>{I.edit}</button>
                    {u.id !== currentUser.id && <button className="btn btn-sm btn-secondary" onClick={() => openReset(u)}>Reset Password</button>}
                    <button className="btn btn-sm btn-danger" onClick={() => del(u.id)}>{I.del}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "add" ? "Add User" : "Edit User"} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save User</button></>}>
          <div className="form-group"><label>Full Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" /></div>
          <div className="form-group"><label>Email</label><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@store.com" /></div>
          <div className="form-row">
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={modal === "edit" ? "Leave blank to keep current" : "Password"} />
            </div>
            <div className="form-group"><label>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Status</label>
            <select value={form.active ? "active" : "inactive"} onChange={e => setForm(f => ({ ...f, active: e.target.value === "active" }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </Modal>
      )}

      {resetUser && (
        <Modal title={`Reset Password: ${resetUser.name}`} onClose={() => setResetUser(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setResetUser(null)}>Cancel</button><button className="btn btn-primary" onClick={resetPassword}>Reset Password</button></>}>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={passwordForm.password} onChange={e => setPasswordForm(f => ({ ...f, password: e.target.value }))} placeholder="At least 8 characters" />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Confirm password" />
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
function Customers({ customers, onAdd, onEdit, onDelete, canManage = false }) {
  const emptyForm = { name: "", phone: "", email: "", address: "" };
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const query = search.toLowerCase();
  const filtered = customers.filter(customer =>
    customer.name.toLowerCase().includes(query)
    || String(customer.phone || "").toLowerCase().includes(query)
    || String(customer.email || "").toLowerCase().includes(query)
    || customer.address.toLowerCase().includes(query)
  );

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setModal("add");
  };

  const openEdit = (customer) => {
    setForm({ name: customer.name, phone: customer.phone || "", email: customer.email || "", address: customer.address });
    setEditId(customer.id);
    setModal("edit");
  };

  const save = async () => {
    if (!form.name.trim() || !form.address.trim() || (!form.phone.trim() && !form.email.trim())) return;
    try {
      if (modal === "edit") {
        await onEdit(editId, form);
      } else {
        await onAdd(form);
      }
      setModal(null);
    } catch (err) {
      alert(err.message || "Error saving customer");
    }
  };

  const del = async (id) => {
    if (!confirm("Delete this customer record? Past receipts will keep their customer snapshot.")) return;
    try {
      await onDelete(id);
    } catch (err) {
      alert(err.message || "Error deleting customer");
    }
  };

  return (
    <>
      <div className="section-header">
        <h2>Customers</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="search-wrap">
            <span className="search-icon">{I.search}</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customers…" style={{ width: 220 }} />
          </div>
          <button className="btn btn-primary" onClick={openAdd}>{I.add} Add Customer</button>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Address</th>{canManage && <th>Actions</th>}</tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={canManage ? 5 : 4}><div className="empty">No customers found</div></td></tr> :
              filtered.map(customer => (
                <tr key={customer.id}>
                  <td style={{ color: "var(--text)", fontWeight: 600 }}>{customer.name}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{customer.phone || "-"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{customer.email || "-"}</td>
                  <td>{customer.address}</td>
                  {canManage && <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(customer)}>{I.edit}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(customer.id)}>{I.del}</button>
                    </div>
                  </td>}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "edit" ? "Edit Customer" : "Add Customer"} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save Customer</button></>}>
          <div className="form-group"><label>Customer Name</label><input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Full name or business name" /></div>
          <div className="form-row">
            <div className="form-group"><label>Phone Number</label><input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} placeholder="Phone number" /></div>
            <div className="form-group"><label>Email Address</label><input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="customer@example.com" /></div>
          </div>
          <div className="form-group"><label>Address</label><textarea value={form.address} onChange={event => setForm(current => ({ ...current, address: event.target.value }))} placeholder="Customer address" /></div>
        </Modal>
      )}
    </>
  );
}

// ─── ADMIN: Transactions ──────────────────────────────────────────────────────
function AdminTransactions({ txns, onPrintReceipt, onRefund, canPrint = false, canRefund = false }) {
  const [search, setSearch] = useState("");
  const [refundReceipt, setRefundReceipt] = useState(null);
  const [refundForm, setRefundForm] = useState({ reason: "", items: {} });
  const receipts = buildReceipts(txns);
  const query = search.toLowerCase();
  const filtered = receipts.filter(receipt =>
    receipt.receiptNo.toLowerCase().includes(query) ||
    receipt.userName.toLowerCase().includes(query) ||
    receipt.customer.name.toLowerCase().includes(query) ||
    receipt.customer.contact.toLowerCase().includes(query) ||
    receipt.items.some(item => item.itemName.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query))
  ).slice(0, 50);

  const openRefund = (receipt) => {
    setRefundReceipt(receipt);
    setRefundForm({
      reason: "",
      items: Object.fromEntries(receipt.items.map(item => [item.id, { qty: 0, restock: true }])),
    });
  };

  const submitRefund = async () => {
    const items = Object.entries(refundForm.items)
      .filter(([, item]) => Number(item.qty) > 0)
      .map(([transactionId, item]) => ({ transactionId, qty: Number(item.qty), restock: item.restock }));
    if (!refundForm.reason.trim() || items.length === 0) return;

    try {
      await onRefund(refundReceipt.id, { reason: refundForm.reason, items });
      setRefundReceipt(null);
    } catch (err) {
      alert(err.message || "Error processing refund");
    }
  };

  return (
    <>
      <div className="section-header">
        <h2>Receipts</h2>
        <div className="search-wrap">
          <span className="search-icon">{I.search}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search receipts…" style={{ width: 240 }} />
        </div>
      </div>
      <div className="table-card">
        <table>
          <thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Sold By</th><th>Items</th><th>Net Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={8}><div className="empty">No receipts</div></td></tr> :
              filtered.map(receipt => (
                <tr key={receipt.id}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{receipt.date}<br />{receipt.time}</td>
                  <td><span className="badge-pill gray">{receipt.receiptNo}</span></td>
                  <td>
                    <div style={{ color: "var(--text)", fontWeight: 600 }}>{receipt.customer.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>{receipt.customer.contact}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{receipt.customer.address}</div>
                  </td>
                  <td>{receipt.userName}</td>
                  <td><span className="badge-pill blue">{receipt.qty - receipt.refundedQty} of {receipt.qty} units</span></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{fmt(receipt.netTotal)}</td>
                  <td><span className={`badge-pill ${receipt.refundedQty === receipt.qty ? "red" : receipt.refundedQty > 0 ? "orange" : receipt.receiptPrinted ? "green" : "gray"}`}>{receipt.refundedQty === receipt.qty ? "Refunded" : receipt.refundedQty > 0 ? "Partially refunded" : receipt.receiptPrinted ? "Printed" : "Active"}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {canPrint && <>
                        <button className="btn btn-sm btn-secondary" onClick={() => onPrintReceipt(receipt, "customer")}>Customer</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => onPrintReceipt(receipt, "record")}>Record</button>
                        <button className="btn btn-sm btn-primary" onClick={() => onPrintReceipt(receipt, "both")}>Both</button>
                      </>}
                      {canRefund && receipt.refundedQty < receipt.qty && <button className="btn btn-sm btn-danger" onClick={() => openRefund(receipt)}>Refund</button>}
                      {!canPrint && !canRefund && <span className="badge-pill gray">View only</span>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {refundReceipt && (
        <Modal title={`Refund Receipt: ${refundReceipt.receiptNo}`} onClose={() => setRefundReceipt(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setRefundReceipt(null)}>Cancel</button><button className="btn btn-danger" onClick={submitRefund}>Process Refund</button></>}>
          <div className="form-group">
            <label>Reason</label>
            <textarea value={refundForm.reason} onChange={event => setRefundForm(current => ({ ...current, reason: event.target.value }))} placeholder="Return reason, payment reversal, damaged item..." />
          </div>
          <table>
            <thead><tr><th>Item</th><th>Refundable</th><th>Return Qty</th><th>Restock</th></tr></thead>
            <tbody>
              {refundReceipt.items.map(item => {
                const refundable = Number(item.qty || 0) - Number(item.refundedQty || 0);
                return (
                  <tr key={item.id}>
                    <td><div style={{ color: "var(--text)", fontWeight: 600 }}>{item.itemName}</div><span className="badge-pill gray">{item.sku}</span></td>
                    <td>{refundable}</td>
                    <td><input type="number" min="0" max={refundable} value={refundForm.items[item.id]?.qty || 0} onChange={event => setRefundForm(current => ({ ...current, items: { ...current.items, [item.id]: { ...current.items[item.id], qty: event.target.value } } }))} style={{ width: 82 }} /></td>
                    <td><input type="checkbox" checked={refundForm.items[item.id]?.restock ?? true} onChange={event => setRefundForm(current => ({ ...current, items: { ...current.items, [item.id]: { ...current.items[item.id], restock: event.target.checked } } }))} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}

// ─── ADMIN: Data Tools ───────────────────────────────────────────────────────
function AdminDataTools({ txns, onClearHistory, onResetFresh, onResetDemo, canManageData = false }) {
  const [period, setPeriod] = useState("daily");
  const [startDate, setStartDate] = useState(getStartDateForPeriod("daily"));
  const [endDate, setEndDate] = useState(todayString());

  const syncPeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== "custom" && nextPeriod !== "all") {
      setStartDate(getStartDateForPeriod(nextPeriod));
      setEndDate(todayString());
    }
  };

  const filteredTxns = txns.filter(txn => {
    if (period === "all") return true;
    return txn.date >= startDate && txn.date <= endDate;
  });

  const downloadHistory = () => {
    const rows = [
      ["Receipt No", "Date", "Time", "Sold By", "Customer Name", "Customer Address", "Customer Contact", "SKU", "Item", "Category", "Supplier", "Sold Qty", "Refunded Qty", "Net Qty", "Unit Cost", "Unit Price", "Net Cost", "Gross Amount", "Refunded Amount", "Net Amount", "Net Profit", "User Printed"],
      ...filteredTxns.map(txn => [
        txn.receiptNo || getReceiptId(txn),
        txn.date,
        txn.time,
        txn.userName,
        txn.customer?.name || "",
        txn.customer?.address || "",
        txn.customer?.contact || "",
        txn.sku,
        txn.itemName,
        txn.category || "General",
        txn.supplier || "",
        txn.qty,
        txn.refundedQty || 0,
        getTxnQty(txn),
        txn.unitCost || 0,
        txn.unitAmount ?? txn.amount / txn.qty,
        getTxnCost(txn),
        txn.amount,
        txn.refundedAmount || 0,
        getTxnRevenue(txn),
        getTxnProfit(txn),
        txn.receiptPrinted ? "Yes" : "No",
      ]),
    ];
    downloadCSV(`sales-history-${period}-${todayString()}.csv`, rows);
  };

  return (
    <>
      <div className="section-header">
        <h2>Data Tools</h2>
      </div>

      <div className="table-card">
        <div className="table-header"><h3>Download Sales History</h3></div>
        <div style={{ padding: 20 }}>
          <div className="form-row">
            <div className="form-group">
              <label>Period</label>
              <select value={period} onChange={e => syncPeriod(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom Date Range</option>
                <option value="all">All History</option>
              </select>
            </div>
            <div className="form-group">
              <label>Matching Records</label>
              <input value={`${filteredTxns.length} transaction row(s)`} readOnly />
            </div>
          </div>
          {period !== "all" && (
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" value={startDate} disabled={period !== "custom"} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" value={endDate} disabled={period !== "custom"} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          )}
          <button className="btn btn-primary" disabled={filteredTxns.length === 0} onClick={downloadHistory}>Download CSV</button>
        </div>
      </div>

      {canManageData && <div className="table-card">
        <div className="table-header"><h3>Reset and Delete Data</h3></div>
        <div style={{ padding: 20, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Delete sales history</div>
              <div style={{ color: "var(--text3)", fontSize: 12 }}>Clears transactions, receipts, notifications, and resets sold counts.</div>
            </div>
            <button className="btn btn-danger" onClick={onClearHistory}>Delete History</button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Start fresh</div>
              <div style={{ color: "var(--text3)", fontSize: 12 }}>Clears inventory, users, history, and notifications. Keeps only the current admin account.</div>
            </div>
            <button className="btn btn-danger" onClick={onResetFresh}>Start Fresh</button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Restore demo data</div>
              <div style={{ color: "var(--text3)", fontSize: 12 }}>Resets everything back to the original sample inventory, users, and generated sales.</div>
            </div>
            <button className="btn btn-secondary" onClick={onResetDemo}>Restore Demo</button>
          </div>
        </div>
      </div>}
    </>
  );
}

// ─── ADMIN: Audit Logs ───────────────────────────────────────────────────────
function AdminAuditLogs({ logs }) {
  const [search, setSearch] = useState("");
  const query = search.toLowerCase();
  const filtered = logs.filter(log =>
    log.action.toLowerCase().includes(query) ||
    log.entityType.toLowerCase().includes(query) ||
    log.summary.toLowerCase().includes(query) ||
    String(log.actorName || "").toLowerCase().includes(query)
  ).slice(0, 200);

  const actionClass = (action) => {
    if (action.includes("delete") || action.includes("reset")) return "red";
    if (action.includes("login") || action.includes("refresh")) return "blue";
    if (action.includes("create") || action.includes("sale")) return "green";
    if (action.includes("update") || action.includes("password")) return "orange";
    return "gray";
  };

  return (
    <>
      <div className="section-header">
        <h2>Audit Logs</h2>
        <div className="search-wrap">
          <span className="search-icon">{I.search}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activity..." style={{ width: 260 }} />
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead><tr><th>Time</th><th>Action</th><th>Summary</th><th>Actor</th><th>Entity</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={5}><div className="empty">No audit logs yet</div></td></tr> :
              filtered.map(log => (
                <tr key={log.id}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{new Date(log.createdAt).toLocaleString()}</td>
                  <td><span className={`badge-pill ${actionClass(log.action)}`}>{log.action}</span></td>
                  <td style={{ color: "var(--text)", fontWeight: 600 }}>{log.summary}</td>
                  <td>
                    <div style={{ color: "var(--text2)" }}>{log.actorName || "System"}</div>
                    {log.actorRole && <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text3)" }}>{ROLE_LABELS[log.actorRole] || log.actorRole}</div>}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{log.entityType}{log.entityId ? ` #${log.entityId}` : ""}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function BusinessSettings({ businessProfile, license, receiptSettings, user, onSaveProfile, onSaveLicense, onSaveReceiptSettings }) {
  const [form, setForm] = useState(businessProfile || DEFAULT_BUSINESS_PROFILE);
  const [licenseForm, setLicenseForm] = useState(license || DEFAULT_LICENSE);
  const [receiptForm, setReceiptForm] = useState(receiptSettings || DEFAULT_RECEIPT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [savingLicense, setSavingLicense] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);

  const update = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const updateLicense = (field, value) => {
    setLicenseForm(current => ({ ...current, [field]: value }));
  };

  const updateReceipt = (field, value) => {
    setReceiptForm(current => ({ ...current, [field]: value }));
  };

  const save = async () => {
    if (!form.businessName || !form.address || !form.phone || !form.email) {
      alert("Business name, address, phone, and email are required.");
      return;
    }

    setSaving(true);
    try {
      await onSaveProfile(form);
      alert("Business settings saved.");
    } catch (err) {
      alert(err.message || "Unable to save business settings");
    } finally {
      setSaving(false);
    }
  };

  const saveLicense = async () => {
    if (licenseForm.mode === "saas" && !licenseForm.expiresAt) {
      alert("SaaS licenses require an expiry date.");
      return;
    }

    setSavingLicense(true);
    try {
      await onSaveLicense({ ...licenseForm, seats: Number(licenseForm.seats) });
      alert("License settings saved.");
    } catch (err) {
      alert(err.message || "Unable to save license settings");
    } finally {
      setSavingLicense(false);
    }
  };

  const saveReceiptSettings = async () => {
    if (!receiptForm.prefix) {
      alert("Receipt prefix is required.");
      return;
    }

    setSavingReceipt(true);
    try {
      await onSaveReceiptSettings({
        ...receiptForm,
        nextNumber: Number(receiptForm.nextNumber),
        minDigits: Number(receiptForm.minDigits),
      });
      alert("Receipt numbering settings saved.");
    } catch (err) {
      alert(err.message || "Unable to save receipt numbering settings");
    } finally {
      setSavingReceipt(false);
    }
  };

  const receiptPreview = formatReceiptPreview(receiptForm);

  return (
    <>
      <div className="section-header">
        <h2>Instance Settings</h2>
      </div>

      <div className="settings-grid">
        <div className="table-card">
          <div className="table-header"><h3>Receipt Business Details</h3></div>
          <div style={{ padding: 20 }}>
            <div className="form-group">
              <label>Business Name</label>
              <input value={form.businessName} onChange={e => update("businessName", e.target.value)} placeholder="Business name" />
            </div>
            <div className="form-group">
              <label>Address</label>
              <textarea value={form.address} onChange={e => update("address", e.target.value)} placeholder="Business address" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone Number</label>
                <input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="Phone number" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="email@business.com" />
              </div>
            </div>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</button>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <h3>Subscription and License</h3>
            <span className={`badge-pill ${LICENSE_STATUS_CLASS[licenseForm.status] || "gray"}`}>
              {LICENSE_LABELS[licenseForm.status] || licenseForm.status}
            </span>
          </div>
          <div style={{ padding: 20 }}>
            <div className="license-summary">
              <div>
                <span>Mode</span>
                <strong>{LICENSE_LABELS[licenseForm.mode] || licenseForm.mode}</strong>
              </div>
              <div>
                <span>Plan</span>
                <strong>{LICENSE_LABELS[licenseForm.plan] || licenseForm.plan}</strong>
              </div>
              <div>
                <span>Seats</span>
                <strong>{licenseForm.seats}</strong>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Install Mode</label>
                <select value={licenseForm.mode} onChange={e => updateLicense("mode", e.target.value)}>
                  <option value="standalone">Standalone</option>
                  <option value="saas">SaaS</option>
                </select>
              </div>
              <div className="form-group">
                <label>Plan</label>
                <select value={licenseForm.plan} onChange={e => updateLicense("plan", e.target.value)}>
                  <option value="standalone">Standalone</option>
                  <option value="trial">Trial</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Status</label>
                <select value={licenseForm.status} onChange={e => updateLicense("status", e.target.value)}>
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="past_due">Past Due</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="form-group">
                <label>Active User Seats</label>
                <input type="number" min="1" value={licenseForm.seats} onChange={e => updateLicense("seats", e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Expiry Date</label>
                <input type="date" value={licenseForm.expiresAt || ""} onChange={e => updateLicense("expiresAt", e.target.value)} />
              </div>
              <div className="form-group">
                <label>License Key</label>
                <input value={licenseForm.licenseKey || ""} onChange={e => updateLicense("licenseKey", e.target.value)} placeholder="License key" />
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveLicense} disabled={savingLicense}>{savingLicense ? "Saving..." : "Save License"}</button>
          </div>
        </div>

        <div className="table-card receipt-preview-card">
          <div className="table-header"><h3>Receipt Preview</h3></div>
          <div className="receipt-preview">
            <h3>{form.businessName || "Business Name"}</h3>
            <p>{form.address || "Business address"}</p>
            <p>{form.phone || "Phone number"}{form.phone && form.email ? " | " : ""}{form.email || "Email address"}</p>
            <div className="preview-divider" />
            <p><strong>Receipt No:</strong> {receiptPreview}</p>
            <p><strong>Sold By:</strong> {user.name}</p>
            <div className="preview-divider" />
            <p className="preview-footer">{RECEIPT_FOOTER}</p>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <h3>Receipt Numbering</h3>
            <span className="badge-pill blue">{receiptPreview}</span>
          </div>
          <div style={{ padding: 20 }}>
            <div className="form-row">
              <div className="form-group">
                <label>Prefix</label>
                <input value={receiptForm.prefix} onChange={e => updateReceipt("prefix", e.target.value.toUpperCase())} placeholder="SALE" />
              </div>
              <div className="form-group">
                <label>Separator</label>
                <select value={receiptForm.separator} onChange={e => updateReceipt("separator", e.target.value)}>
                  <option value="-">Dash (-)</option>
                  <option value="/">Slash (/)</option>
                  <option value="">None</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Next Number</label>
                <input type="number" min="1" value={receiptForm.nextNumber} onChange={e => updateReceipt("nextNumber", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Minimum Digits</label>
                <input type="number" min="1" max="12" value={receiptForm.minDigits} onChange={e => updateReceipt("minDigits", e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveReceiptSettings} disabled={savingReceipt}>{savingReceipt ? "Saving..." : "Save Receipt Numbering"}</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── ACCOUNT SECURITY ────────────────────────────────────────────────────────
function AccountSecurity({ user, onChangePassword }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);

  const update = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const save = async () => {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      alert("Current password, new password, and confirmation are required.");
      return;
    }

    setSaving(true);
    try {
      await onChangePassword(form);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alert("Password changed successfully.");
    } catch (err) {
      alert(err.message || "Unable to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="section-header">
        <h2>Account</h2>
      </div>

      <div className="settings-grid">
        <div className="table-card">
          <div className="table-header"><h3>Change Password</h3></div>
          <div style={{ padding: 20 }}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" value={form.currentPassword} onChange={e => update("currentPassword", e.target.value)} placeholder="Current password" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={form.newPassword} onChange={e => update("newPassword", e.target.value)} placeholder="At least 8 characters" />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input type="password" value={form.confirmPassword} onChange={e => update("confirmPassword", e.target.value)} placeholder="Confirm password" />
              </div>
            </div>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Change Password"}</button>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header"><h3>Profile</h3></div>
          <div className="account-profile">
            <div className="sidebar-avatar" style={{ background: "rgba(47,111,237,0.12)", color: "var(--accent2)" }}>
              {user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <span>{ROLE_LABELS[user.role] || user.role}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── USER: Dashboard ──────────────────────────────────────────────────────────
function UserDashboard({ currentUser, items, txns }) {
  const { period, setPeriod, startDate, setStartDate, endDate, setEndDate } =
    usePersistedDashboardRange(getDashboardRangeStorageKey("user", currentUser));
  const myTxns = txns.filter(t => t.userId === currentUser.id);
  const rangeLabel = getRangeLabel(period, startDate, endDate);
  const filtered = myTxns.filter(t => inDateRange(t, startDate, endDate));
  const now = new Date();
  const myRevenue = filtered.reduce((s, t) => s + getTxnRevenue(t), 0);
  const myUnits = filtered.reduce((s, t) => s + getTxnQty(t), 0);
  const itemRevenue = {};
  filtered.forEach(t => {
    itemRevenue[t.itemId] = itemRevenue[t.itemId] || { name: t.itemName, sku: t.sku, qty: 0, revenue: 0 };
    itemRevenue[t.itemId].qty += getTxnQty(t);
    itemRevenue[t.itemId].revenue += getTxnRevenue(t);
  });
  const itemRevenueRows = Object.values(itemRevenue).sort((a, b) => b.revenue - a.revenue);

  const days7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split("T")[0]; });
  const barData = days7.map(day => ({
    l: new Date(day).toLocaleDateString("en", { weekday: "short" }).slice(0, 2),
    v: myTxns.filter(t => t.date === day).reduce((s, t) => s + getTxnRevenue(t), 0),
  }));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>My Dashboard</h2>
          <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>Welcome back, {currentUser.name.split(" ")[0]}</p>
        </div>
        <PeriodRangeControl period={period} setPeriod={setPeriod} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
      </div>

      <div className="stat-grid">
        <div className="stat-card green">
          <div className="stat-label">My Revenue</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{fmt(myRevenue)}</div>
          <div className="stat-sub">{rangeLabel}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Units Sold</div>
          <div className="stat-value" style={{ color: "var(--accent2)" }}>{myUnits}</div>
          <div className="stat-sub">{filtered.length} transactions</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Total Earned</div>
          <div className="stat-value" style={{ color: "var(--accent3)" }}>{fmt(myTxns.reduce((s, t) => s + getTxnRevenue(t), 0))}</div>
          <div className="stat-sub">all time</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Items in Store</div>
          <div className="stat-value" style={{ color: "var(--accent4)" }}>{items.length}</div>
          <div className="stat-sub">{items.reduce((s, i) => s + i.qty, 0)} total units</div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h4>My Sales (7 days)</h4>
          <p>Daily revenue performance</p>
          <BarChart data={barData} color="var(--accent4)" />
        </div>
        <div className="chart-card">
          <h4>Stock Status</h4>
          <p>Current inventory levels</p>
          {items.slice(0, 5).map(item => {
            const pct = Math.min(100, (item.qty / 50) * 100);
            const threshold = getItemThreshold(item);
            const color = item.qty <= threshold ? "var(--danger)" : item.qty <= threshold * 2 ? "var(--warn)" : "var(--accent)";
            return (
              <div key={item.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: "var(--text2)" }}>{item.name}</span>
                  <span style={{ fontFamily: "var(--mono)", color }}>{item.qty}</span>
                </div>
                <div className="progress"><div className="progress-bar" style={{ width: `${pct}%`, background: color }} /></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="table-card">
        <div className="table-header"><h3>My Item Revenue</h3></div>
        <table>
          <thead><tr><th>Item</th><th>SKU</th><th>Units Sold</th><th>Revenue</th></tr></thead>
          <tbody>
            {itemRevenueRows.length === 0 ? <tr><td colSpan={4}><div className="empty">No item revenue in this range</div></td></tr> :
              itemRevenueRows.map((item, index) => (
                <tr key={`${item.sku}-${index}`}>
                  <td style={{ color: "var(--text)" }}>{item.name}</td>
                  <td><span className="badge-pill gray">{item.sku}</span></td>
                  <td><span className="badge-pill blue">{item.qty}</span></td>
                  <td style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(item.revenue)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="table-card">
        <div className="table-header"><h3>Recent Transactions</h3></div>
        <table>
          <thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
          <tbody>
            {myTxns.slice().reverse().slice(0, 10).length === 0 ? <tr><td colSpan={4}><div className="empty">No transactions yet</div></td></tr> :
              myTxns.slice().reverse().slice(0, 10).map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{t.date} {t.time}</td>
                  <td style={{ color: "var(--text)", fontWeight: 600 }}>{t.itemName}</td>
                  <td><span className="badge-pill blue">{getTxnQty(t)}</span></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{fmt(getTxnRevenue(t))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── USER: Receipts ──────────────────────────────────────────────────────────
function UserReceipts({ txns, onPrintReceipt }) {
  const [search, setSearch] = useState("");
  const query = search.toLowerCase();
  const receipts = buildReceipts(txns).filter(receipt =>
    receipt.receiptNo.toLowerCase().includes(query) ||
    receipt.customer.name.toLowerCase().includes(query) ||
    receipt.customer.contact.toLowerCase().includes(query) ||
    receipt.items.some(item => item.itemName.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query))
  );

  return (
    <>
      <div className="section-header">
        <h2>Receipts</h2>
        <div className="search-wrap">
          <span className="search-icon">{I.search}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search receipts…" style={{ width: 220 }} />
        </div>
      </div>
      <div className="table-card">
        <table>
          <thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Print</th></tr></thead>
          <tbody>
            {receipts.length === 0 ? <tr><td colSpan={7}><div className="empty">No receipts yet</div></td></tr> :
              receipts.map(receipt => (
                <tr key={receipt.id}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{receipt.date}<br />{receipt.time}</td>
                  <td><span className="badge-pill gray">{receipt.receiptNo}</span></td>
                  <td>
                    <div style={{ color: "var(--text)", fontWeight: 600 }}>{receipt.customer.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>{receipt.customer.contact}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{receipt.customer.address}</div>
                  </td>
                  <td><span className="badge-pill blue">{receipt.qty - receipt.refundedQty} of {receipt.qty} units</span></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{fmt(receipt.netTotal)}</td>
                  <td><span className={`badge-pill ${receipt.refundedQty === receipt.qty ? "red" : receipt.refundedQty > 0 ? "orange" : receipt.receiptPrinted ? "green" : "gray"}`}>{receipt.refundedQty === receipt.qty ? "Refunded" : receipt.refundedQty > 0 ? "Partially refunded" : receipt.receiptPrinted ? "Printed" : "Available"}</span></td>
                  <td>
                    <button className="btn btn-sm btn-primary" disabled={receipt.receiptPrinted} onClick={() => onPrintReceipt(receipt, "both")}>
                      Print Copies
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── USER: Make a Sale ────────────────────────────────────────────────────────
function UserSell({ items, customers, onSell, onPrintReceipt }) {
  const [cart, setCart] = useState({});
  const [customerId, setCustomerId] = useState("");
  const [customer, setCustomer] = useState({ name: "", address: "", phone: "", email: "" });
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  const available = items.filter(i => i.qty > 0);
  const cartItems = Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => ({ ...items.find(i => i.id === +id), qty }));
  const total = cartItems.reduce((s, i) => s + i.amount * i.qty, 0);
  const customerComplete = customer.name.trim() && customer.address.trim() && (customer.phone.trim() || customer.email.trim());

  const selectCustomer = (id) => {
    setCustomerId(id);
    const selected = customers.find(item => String(item.id) === String(id));
    setCustomer(selected
      ? { name: selected.name, address: selected.address, phone: selected.phone || "", email: selected.email || "" }
      : { name: "", address: "", phone: "", email: "" });
  };

  const set = (id, delta) => {
    const item = items.find(i => i.id === id);
    const cur = cart[id] || 0;
    const next = Math.max(0, Math.min(item.qty, cur + delta));
    setCart(c => ({ ...c, [id]: next }));
  };

  const submit = async () => {
    if (cartItems.length === 0) return;
    if (!customerComplete) {
      alert("Customer name, address, and a phone number or email address are required for the receipt.");
      return;
    }
    try {
      const result = await onSell(cartItems.map(ci => ({ id: ci.id, qty: ci.qty })), customerId, customer);
      setLastReceipt(result.receipt);
      setCart({});
      setCustomerId("");
      setCustomer({ name: "", address: "", phone: "", email: "" });
      setConfirm(false);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      alert(err.message || "Error completing sale");
    }
  };

  return (
    <>
      <div className="section-header"><h2>Make a Sale</h2></div>

      {done && (
        <div style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "var(--accent)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{I.check} Sale completed successfully!</span>
          {lastReceipt && (
            <button className="btn btn-sm btn-primary" style={{ marginLeft: "auto" }} disabled={lastReceipt.receiptPrinted} onClick={() => onPrintReceipt(lastReceipt, "both").then(() => setLastReceipt(r => r ? { ...r, receiptPrinted: true } : r)).catch(() => {})}>
              {lastReceipt.receiptPrinted ? "Receipt Printed" : "Print Customer + Record Copies"}
            </button>
          )}
        </div>
      )}

      <div className="sell-layout">
        <div className="table-card">
          <div className="table-header"><h3>Available Items</h3></div>
          {available.map(item => (
            <div key={item.id} className="sell-item-row" style={{ padding: "12px 20px" }}>
              <div className="sell-item-info">
                <p>{item.name}</p>
                <span>{item.sku} · {fmt(item.amount)} · {item.qty} left</span>
              </div>
              <div className="qty-control">
                <button className="qty-btn" onClick={() => set(item.id, -1)}>−</button>
                <span className="qty-value">{cart[item.id] || 0}</span>
                <button className="qty-btn" onClick={() => set(item.id, 1)}>+</button>
              </div>
            </div>
          ))}
          {available.length === 0 && <div className="empty">No items in stock</div>}
        </div>

        <div>
          <div className="table-card">
            <div className="table-header"><h3>Cart Summary</h3></div>
            <div style={{ padding: "0 20px" }}>
              {cartItems.length === 0 ? <div className="empty" style={{ padding: "20px 0" }}>Empty cart</div> :
                cartItems.map(ci => (
                  <div key={ci.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <div>
                      <div style={{ color: "var(--text)", fontWeight: 600 }}>{ci.name}</div>
                      <div style={{ color: "var(--text3)", fontFamily: "var(--mono)" }}>x{ci.qty} @ {fmt(ci.amount)}</div>
                    </div>
                    <div style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontWeight: 700 }}>{fmt(ci.amount * ci.qty)}</div>
                  </div>
                ))}
            </div>
            {cartItems.length > 0 && (
              <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontWeight: 800, fontSize: 16 }}>{fmt(total)}</span>
                </div>
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setConfirm(true)}>
                  {I.check} Confirm Sale
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirm && (
        <Modal title="Confirm Sale" onClose={() => setConfirm(false)}
          footer={<><button className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={!customerComplete}>Complete Sale</button></>}>
          <div className="form-group">
            <label>Customer Record</label>
            <select value={customerId} onChange={event => selectCustomer(event.target.value)}>
              <option value="">Create New Customer</option>
              {customers.map(item => <option key={item.id} value={item.id}>{item.name} - {item.phone || item.email}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Customer Name</label>
              <input value={customer.name} onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} placeholder="Customer full name" disabled={Boolean(customerId)} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} placeholder="Phone number" disabled={Boolean(customerId)} />
            </div>
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={customer.email} onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))} placeholder="customer@example.com" disabled={Boolean(customerId)} />
          </div>
          <div className="form-group">
            <label>Customer Address</label>
            <textarea value={customer.address} onChange={e => setCustomer(c => ({ ...c, address: e.target.value }))} placeholder="Customer address" disabled={Boolean(customerId)} />
          </div>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>You are about to complete a sale of <strong style={{ color: "var(--accent)" }}>{fmt(total)}</strong> for {cartItems.length} item(s).</p>
          {cartItems.map(ci => (
            <div key={ci.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span>{ci.name} × {ci.qty}</span>
              <span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{fmt(ci.amount * ci.qty)}</span>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}

// ─── USER: Store View ─────────────────────────────────────────────────────────
function UserStore({ items }) {
  const [search, setSearch] = useState("");
  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="section-header">
        <h2>Store Items</h2>
        <div className="search-wrap">
          <span className="search-icon">{I.search}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: 200 }} />
        </div>
      </div>
      <div className="table-card">
        <table>
          <thead><tr><th>SKU</th><th>Name</th><th>Price</th><th>In Stock</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id}>
                <td><span className="badge-pill gray">{item.sku}</span></td>
                <td style={{ color: "var(--text)", fontWeight: 600 }}>{item.name}</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{fmt(item.amount)}</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{item.qty}</td>
                <td><span className={`badge-pill ${item.qty === 0 ? "red" : item.qty <= getItemThreshold(item) ? "orange" : "green"}`}>{item.qty === 0 ? "Out of stock" : item.qty <= getItemThreshold(item) ? "Low stock" : "In stock"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user, logout, updateUser, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [txns, setTxns] = useState([]);
  const [stockAdjustments, setStockAdjustments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [businessProfile, setBusinessProfile] = useState(DEFAULT_BUSINESS_PROFILE);
  const [license, setLicense] = useState(user?.license || DEFAULT_LICENSE);
  const [receiptSettings, setReceiptSettings] = useState(DEFAULT_RECEIPT_SETTINGS);
  const [auditLogs, setAuditLogs] = useState([]);
  const [page, setPage] = useState("dashboard");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const itemsData = await api.get("/inventory");
      setItems(itemsData);

      if (hasPermission(user, "manageInventory")) {
        const adjustmentsData = await api.get("/inventory/adjustments");
        setStockAdjustments(adjustmentsData);
      }

      const txnsData = await api.get("/transactions");
      setTxns(txnsData);

      if (hasPermission(user, "viewCustomers")) {
        const customersData = await api.get("/customers");
        setCustomers(customersData);
      }

      const notifsData = await api.get("/notifications");
      setNotifications(notifsData);

      const profileData = await api.get("/settings/business-profile");
      setBusinessProfile(profileData);

      const licenseData = await api.get("/settings/license");
      setLicense(licenseData);

      const receiptSettingsData = await api.get("/settings/receipt-numbering");
      setReceiptSettings(receiptSettingsData);

      if (hasPermission(user, "manageUsers")) {
        const usersData = await api.get("/users");
        setUsers(usersData);
      }

      if (hasPermission(user, "manageData")) {
        const logsData = await api.get("/audit");
        setAuditLogs(logsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  // Inventory API Operations
  const handleAddItem = async (form) => {
    await api.post("/inventory", form);
    fetchData();
  };

  const handleEditItem = async (id, form) => {
    await api.put(`/inventory/${id}`, form);
    fetchData();
  };

  const handleDeleteItem = async (id) => {
    await api.delete(`/inventory/${id}`);
    fetchData();
  };

  const handleAdjustStock = async (id, form) => {
    await api.post(`/inventory/${id}/adjust`, form);
    await fetchData();
  };

  const handleBulkImport = async (itemsToImport) => {
    const result = await api.post("/inventory/bulk", { items: itemsToImport });
    await fetchData();
    return result;
  };

  // User API Operations
  const handleAddUser = async (form) => {
    await api.post("/users", form);
    fetchData();
  };

  const handleEditUser = async (id, form) => {
    await api.put(`/users/${id}`, form);
    fetchData();
  };

  const handleDeleteUser = async (id) => {
    await api.delete(`/users/${id}`);
    fetchData();
  };

  const handleToggleUser = async (id, userState) => {
    await api.put(`/users/${id}`, { ...userState, active: !userState.active });
    fetchData();
  };

  const handleResetPassword = async (id, form) => {
    return api.post(`/users/${id}/reset-password`, form);
  };

  const handleClearHistory = async () => {
    if (!confirm("Delete all sales history, receipts, notifications, and reset sold counts?")) return;
    await api.delete("/admin/history");
    await fetchData();
    alert("Sales history deleted.");
  };

  const handleResetFresh = async () => {
    if (!confirm("Start fresh? This clears inventory, users, history, and notifications, keeping only your current admin account.")) return;
    await api.post("/admin/reset", { mode: "fresh" });
    await fetchData();
    setPage("dashboard");
    alert("Data cleared. Your current admin account was kept.");
  };

  const handleResetDemo = async () => {
    if (!confirm("Restore the original demo data? This replaces current inventory, users, history, and notifications.")) return;
    await api.post("/admin/reset", { mode: "seed" });
    await fetchData();
    setPage("dashboard");
    alert("Demo data restored.");
  };

  // Transaction API Operations
  const handleSell = async (cartItems, customerId, customer) => {
    const result = await api.post("/transactions", { cartItems, customerId, customer });
    await fetchData();
    return result;
  };

  const handleRefund = async (receiptId, form) => {
    const result = await api.post(`/transactions/${receiptId}/refund`, form);
    await fetchData();
    return result;
  };

  const handleAddCustomer = async (form) => {
    const result = await api.post("/customers", form);
    await fetchData();
    return result;
  };

  const handleEditCustomer = async (id, form) => {
    const result = await api.put(`/customers/${id}`, form);
    await fetchData();
    return result;
  };

  const handleDeleteCustomer = async (id) => {
    await api.delete(`/customers/${id}`);
    await fetchData();
  };

  const handleSaveBusinessProfile = async (profile) => {
    const result = await api.put("/settings/business-profile", profile);
    setBusinessProfile(result.businessProfile);
    await fetchData();
    return result;
  };

  const handleSaveLicense = async (nextLicense) => {
    const result = await api.put("/settings/license", nextLicense);
    setLicense(result.license);
    updateUser({ ...user, license: result.license });
    await fetchData();
    return result;
  };

  const handleSaveReceiptSettings = async (nextReceiptSettings) => {
    const result = await api.put("/settings/receipt-numbering", nextReceiptSettings);
    setReceiptSettings(result.receiptSettings);
    await fetchData();
    return result;
  };

  const handleChangePassword = async (form) => {
    const result = await api.put("/auth/password", form);
    await logout();
    setPage("dashboard");
    return result;
  };

  const handlePrintReceipt = async (receipt, copyType = "both") => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      alert("The receipt print window was blocked by the browser.");
      return;
    }

    try {
      let printableReceipt = receipt;

      if (!hasPermission(user, "reprintReceipts")) {
        const result = await api.post(`/transactions/${receipt.id}/print`);
        printableReceipt = receiptFromTransactions(result.transactions) || receipt;
      }

      printReceiptDocument(
        { ...printableReceipt, businessProfile: printableReceipt.businessProfile || businessProfile },
        hasPermission(user, "reprintReceipts") ? copyType : "both",
        printWindow
      );
      await fetchData();
    } catch (err) {
      printWindow.close();
      alert(err.message || "Unable to print receipt");
      throw err;
    }
  };

  // Notification API Operations
  const markAll = async () => {
    await api.post("/notifications/mark-read");
    fetchData();
  };

  const handleLogout = () => {
    void logout();
    setPage("dashboard");
    setNotifOpen(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", background: "var(--bg)", color: "var(--text)", justifyContent: "center", alignItems: "center", fontFamily: "var(--font)" }}>
        Loading StockOS...
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const canViewReports = hasPermission(user, "viewReports");
  const canManageInventory = hasPermission(user, "manageInventory");
  const canManageUsers = hasPermission(user, "manageUsers");
  const canViewAllTransactions = hasPermission(user, "viewAllTransactions");
  const canSell = hasPermission(user, "sell");
  const canPrint = hasPermission(user, "printReceipts");
  const canManageSettings = hasPermission(user, "manageSettings");
  const canManageData = hasPermission(user, "manageData");
  const canViewCustomers = hasPermission(user, "viewCustomers");
  const canManageCustomers = hasPermission(user, "manageCustomers");
  const canRefund = hasPermission(user, "manageRefunds");
  const canUseManagementDashboard = canViewReports || canViewAllTransactions;
  const avatarColor = canUseManagementDashboard ? "rgba(199,125,255,0.15)" : "rgba(0,144,255,0.15)";
  const avatarText = user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: I.dash, show: true },
    { id: "inventory", label: "Inventory", icon: I.items, show: canManageInventory || hasPermission(user, "viewInventory") },
    { id: "users", label: "Users", icon: I.users, show: canManageUsers },
    { id: "customers", label: "Customers", icon: I.users, show: canViewCustomers },
    { id: "transactions", label: "Transactions", icon: I.txn, show: canViewAllTransactions },
    { id: "data", label: "Data Tools", icon: I.chart, show: canViewAllTransactions },
    { id: "audit", label: "Audit Logs", icon: I.eye, show: canManageData },
    { id: "sell", label: "Make a Sale", icon: I.sell, show: canSell },
    { id: "receipts", label: "Receipts", icon: I.txn, show: !canViewAllTransactions && canPrint },
    { id: "store", label: "Store Items", icon: I.items, show: !canManageInventory && hasPermission(user, "viewInventory") },
    { id: "account", label: "Account", icon: I.users, show: true },
    { id: "settings", label: "Settings", icon: I.settings, show: canManageSettings },
  ].filter(item => item.show);

  const topbarTitles = { dashboard: "Dashboard", inventory: "Inventory", users: "Users", customers: "Customers", transactions: "Transactions", data: "Data Tools", audit: "Audit Logs", sell: "Make a Sale", receipts: "Receipts", store: "Store Items", account: "Account", settings: "Settings" };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span>SO</span></div>
          <div>
            <h1>Stock<span>OS</span></h1>
            <p>Store Management Platform</p>
          </div>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: avatarColor, color: canUseManagementDashboard ? "var(--accent4)" : "var(--accent2)" }}>{avatarText}</div>
          <div className="sidebar-user-info">
            <p>{user.name.split(" ")[0]}</p>
            <span>{ROLE_LABELS[user.role] || user.role}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Navigation</div>
            {nav.map(n => (
              <div key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
                <span className="nav-icon" aria-hidden="true">{n.icon}</span> {n.label}
              </div>
            ))}
          </div>
        </nav>
        <div className="sidebar-logout">
          <button className="logout-btn" onClick={handleLogout}><span className="nav-icon" aria-hidden="true">{I.logout}</span> Logout</button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <span className="topbar-title">{topbarTitles[page]}</span>
          <div className="topbar-right">
            {canManageInventory && (
              <div style={{ position: "relative" }}>
                <button className="notif-btn" onClick={() => setNotifOpen(o => !o)}>{I.notif}
                  {unreadCount > 0 && <span className="notif-dot" />}
                </button>
                {notifOpen && <NotificationPanel notifications={notifications} onClose={() => setNotifOpen(false)} onMarkAll={markAll} />}
              </div>
            )}
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text3)" }}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        <div className="content">
          {page === "dashboard" && canUseManagementDashboard && <AdminDashboard currentUser={user} items={items} users={users} txns={txns} />}
          {page === "dashboard" && !canUseManagementDashboard && <UserDashboard currentUser={user} items={items} txns={txns} />}
          {page === "inventory" && hasPermission(user, "viewInventory") && <AdminInventory items={items} stockAdjustments={stockAdjustments} onAdd={handleAddItem} onEdit={handleEditItem} onDelete={handleDeleteItem} onAdjust={handleAdjustStock} onBulkImport={handleBulkImport} readOnly={!canManageInventory} />}
          {page === "users" && canManageUsers && <AdminUsers users={users} currentUser={user} onAdd={handleAddUser} onEdit={handleEditUser} onDelete={handleDeleteUser} onToggle={handleToggleUser} onResetPassword={handleResetPassword} />}
          {page === "customers" && canViewCustomers && <Customers customers={customers} onAdd={handleAddCustomer} onEdit={handleEditCustomer} onDelete={handleDeleteCustomer} canManage={canManageCustomers} />}
          {page === "transactions" && canViewAllTransactions && <AdminTransactions txns={txns} onPrintReceipt={handlePrintReceipt} onRefund={handleRefund} canPrint={canPrint} canRefund={canRefund} />}
          {page === "data" && canViewAllTransactions && <AdminDataTools txns={txns} onClearHistory={handleClearHistory} onResetFresh={handleResetFresh} onResetDemo={handleResetDemo} canManageData={canManageData} />}
          {page === "audit" && canManageData && <AdminAuditLogs logs={auditLogs} />}
          {page === "settings" && canManageSettings && <BusinessSettings key={`${JSON.stringify(businessProfile)}-${JSON.stringify(license)}-${JSON.stringify(receiptSettings)}`} businessProfile={businessProfile} license={license} receiptSettings={receiptSettings} user={user} onSaveProfile={handleSaveBusinessProfile} onSaveLicense={handleSaveLicense} onSaveReceiptSettings={handleSaveReceiptSettings} />}
          {page === "account" && <AccountSecurity user={user} onChangePassword={handleChangePassword} />}
          {page === "sell" && canSell && <UserSell items={items} customers={customers} onSell={handleSell} onPrintReceipt={handlePrintReceipt} />}
          {page === "receipts" && !canViewAllTransactions && canPrint && <UserReceipts txns={txns} onPrintReceipt={handlePrintReceipt} />}
          {page === "store" && hasPermission(user, "viewInventory") && <UserStore items={items} />}
        </div>
        <footer className="app-footer">{RECEIPT_FOOTER}</footer>
      </div>
    </div>
  );
}
