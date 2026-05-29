import { useState, useEffect, useCallback } from "react";

// ─── Palette & Fonts ────────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0c10;
    --surface: #111318;
    --surface2: #181b22;
    --surface3: #1e222c;
    --border: #252a36;
    --border2: #2e3444;
    --accent: #00e5a0;
    --accent2: #0090ff;
    --accent3: #ff6b35;
    --accent4: #c77dff;
    --text: #e8eaf0;
    --text2: #8b92a8;
    --text3: #555d75;
    --danger: #ff4757;
    --warn: #ffc107;
    --success: #00e5a0;
    --font: 'Syne', sans-serif;
    --mono: 'DM Mono', monospace;
  }

  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: var(--surface); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

  .app { display: flex; height: 100vh; overflow: hidden; }

  /* ── Sidebar ── */
  .sidebar {
    width: 240px; min-width: 240px; background: var(--surface);
    border-right: 1px solid var(--border); display: flex; flex-direction: column;
    padding: 0; overflow: hidden;
  }
  .sidebar-logo {
    padding: 24px 20px 20px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-logo h1 {
    font-size: 18px; font-weight: 800; letter-spacing: -0.5px;
    color: var(--text);
  }
  .sidebar-logo h1 span { color: var(--accent); }
  .sidebar-logo p { font-size: 11px; color: var(--text3); font-family: var(--mono); margin-top: 2px; }

  .sidebar-user {
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
  }
  .sidebar-avatar {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0;
  }
  .sidebar-user-info p { font-size: 13px; font-weight: 600; }
  .sidebar-user-info span { font-size: 11px; color: var(--text3); font-family: var(--mono); }

  .sidebar-nav { flex: 1; overflow-y: auto; padding: 12px 10px; }
  .nav-section { margin-bottom: 20px; }
  .nav-section-label {
    font-size: 10px; font-family: var(--mono); color: var(--text3);
    letter-spacing: 1.5px; text-transform: uppercase;
    padding: 0 10px; margin-bottom: 6px;
  }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 8px; cursor: pointer;
    font-size: 13px; font-weight: 600; color: var(--text2);
    transition: all 0.15s; position: relative; user-select: none;
  }
  .nav-item:hover { background: var(--surface2); color: var(--text); }
  .nav-item.active { background: var(--surface3); color: var(--accent); }
  .nav-item.active::before {
    content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 3px; height: 18px; background: var(--accent); border-radius: 0 3px 3px 0;
  }
  .nav-item .badge {
    margin-left: auto; background: var(--accent); color: var(--bg);
    font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px;
    font-family: var(--mono);
  }
  .nav-item .badge.red { background: var(--danger); color: #fff; }

  .sidebar-logout {
    padding: 12px 10px; border-top: 1px solid var(--border);
  }
  .logout-btn {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 8px; cursor: pointer;
    font-size: 13px; font-weight: 600; color: var(--danger);
    background: none; border: none; font-family: var(--font);
    transition: background 0.15s;
  }
  .logout-btn:hover { background: rgba(255,71,87,0.1); }

  /* ── Main ── */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar {
    height: 56px; min-height: 56px; background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px; gap: 16px;
  }
  .topbar-title { font-size: 16px; font-weight: 700; }
  .topbar-right { display: flex; align-items: center; gap: 12px; }
  .notif-btn {
    position: relative; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 8px; cursor: pointer; color: var(--text2);
    font-size: 16px; transition: all 0.15s; line-height: 1;
  }
  .notif-btn:hover { border-color: var(--accent); color: var(--accent); }
  .notif-dot {
    position: absolute; top: 4px; right: 4px; width: 8px; height: 8px;
    background: var(--danger); border-radius: 50%; border: 2px solid var(--surface);
  }
  .content { flex: 1; overflow-y: auto; padding: 24px; }

  /* ── Stat Cards ── */
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 18px 20px; position: relative; overflow: hidden;
  }
  .stat-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  }
  .stat-card.green::before { background: var(--accent); }
  .stat-card.blue::before { background: var(--accent2); }
  .stat-card.orange::before { background: var(--accent3); }
  .stat-card.purple::before { background: var(--accent4); }
  .stat-card.red::before { background: var(--danger); }

  .stat-label { font-size: 11px; color: var(--text3); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .stat-value { font-size: 26px; font-weight: 800; margin-bottom: 4px; }
  .stat-sub { font-size: 11px; color: var(--text3); font-family: var(--mono); }
  .stat-icon { position: absolute; right: 16px; top: 16px; font-size: 22px; opacity: 0.15; }

  /* ── Tables ── */
  .table-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden; margin-bottom: 20px;
  }
  .table-header {
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .table-header h3 { font-size: 14px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; padding: 10px 20px; font-size: 10px;
    font-family: var(--mono); text-transform: uppercase; letter-spacing: 1px;
    color: var(--text3); border-bottom: 1px solid var(--border); font-weight: 500;
  }
  td { padding: 12px 20px; font-size: 13px; border-bottom: 1px solid var(--border); color: var(--text2); }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--surface2); }

  .badge-pill {
    display: inline-flex; align-items: center;
    padding: 3px 8px; border-radius: 20px; font-size: 11px;
    font-family: var(--mono); font-weight: 500;
  }
  .badge-pill.green { background: rgba(0,229,160,0.12); color: var(--accent); }
  .badge-pill.red { background: rgba(255,71,87,0.12); color: var(--danger); }
  .badge-pill.blue { background: rgba(0,144,255,0.12); color: var(--accent2); }
  .badge-pill.orange { background: rgba(255,107,53,0.12); color: var(--accent3); }
  .badge-pill.gray { background: rgba(139,146,168,0.12); color: var(--text2); }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 14px; border-radius: 8px; font-size: 12px;
    font-weight: 600; cursor: pointer; border: none; font-family: var(--font);
    transition: all 0.15s; white-space: nowrap;
  }
  .btn-primary { background: var(--accent); color: var(--bg); }
  .btn-primary:hover { background: #00c98c; }
  .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border2); }
  .btn-secondary:hover { border-color: var(--accent); color: var(--accent); }
  .btn-danger { background: rgba(255,71,87,0.15); color: var(--danger); border: 1px solid rgba(255,71,87,0.25); }
  .btn-danger:hover { background: rgba(255,71,87,0.25); }
  .btn-sm { padding: 5px 10px; font-size: 11px; }
  .btn-icon { padding: 6px 8px; }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; backdrop-filter: blur(4px); padding: 20px;
  }
  .modal {
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: 16px; width: 100%; max-width: 480px;
    max-height: 90vh; overflow-y: auto;
  }
  .modal-header {
    padding: 20px 24px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .modal-header h3 { font-size: 16px; font-weight: 700; }
  .modal-close {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 6px; padding: 4px 8px; cursor: pointer;
    color: var(--text2); font-size: 16px; line-height: 1;
  }
  .modal-body { padding: 20px 24px; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; }

  /* ── Forms ── */
  .form-group { margin-bottom: 16px; }
  label { display: block; font-size: 11px; font-family: var(--mono); color: var(--text2); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  input, select, textarea {
    width: 100%; background: var(--surface2); border: 1px solid var(--border2);
    border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text);
    font-family: var(--font); outline: none; transition: border-color 0.15s;
  }
  input:focus, select:focus, textarea:focus { border-color: var(--accent); }
  textarea { resize: vertical; min-height: 80px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  /* ── Charts (SVG-based) ── */
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
  .chart-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 18px 20px;
  }
  .chart-card h4 { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
  .chart-card p { font-size: 11px; color: var(--text3); font-family: var(--mono); margin-bottom: 16px; }
  .bar-chart { display: flex; align-items: flex-end; gap: 6px; height: 100px; }
  .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
  .bar {
    width: 100%; border-radius: 4px 4px 0 0; min-height: 4px;
    transition: height 0.6s cubic-bezier(.25,.8,.25,1);
  }
  .bar-label { font-size: 9px; font-family: var(--mono); color: var(--text3); }

  .line-chart { position: relative; height: 100px; }
  .line-chart svg { width: 100%; height: 100%; }

  /* ── Notifications panel ── */
  .notif-panel {
    position: fixed; right: 16px; top: 64px; width: 320px;
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: 12px; z-index: 500; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .notif-panel-header {
    padding: 14px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .notif-panel-header h4 { font-size: 13px; font-weight: 700; }
  .notif-item {
    padding: 12px 16px; border-bottom: 1px solid var(--border);
    cursor: pointer; transition: background 0.15s;
  }
  .notif-item:hover { background: var(--surface2); }
  .notif-item.unread { border-left: 3px solid var(--accent2); }
  .notif-item p { font-size: 12px; color: var(--text); margin-bottom: 3px; }
  .notif-item span { font-size: 10px; color: var(--text3); font-family: var(--mono); }

  /* ── Login ── */
  .login-page {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: var(--bg); position: relative; overflow: hidden;
  }
  .login-bg {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse 60% 50% at 30% 40%, rgba(0,229,160,0.06) 0%, transparent 70%),
                radial-gradient(ellipse 50% 60% at 70% 60%, rgba(0,144,255,0.06) 0%, transparent 70%);
  }
  .login-card {
    width: 100%; max-width: 400px; padding: 40px;
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: 20px; position: relative; z-index: 1;
  }
  .login-logo { margin-bottom: 32px; }
  .login-logo h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
  .login-logo h1 span { color: var(--accent); }
  .login-logo p { font-size: 12px; color: var(--text3); font-family: var(--mono); }
  .login-tabs { display: flex; gap: 4px; margin-bottom: 24px; background: var(--surface2); border-radius: 8px; padding: 4px; }
  .login-tab {
    flex: 1; padding: 7px; border-radius: 6px; border: none; cursor: pointer;
    font-size: 12px; font-weight: 600; font-family: var(--font);
    background: none; color: var(--text3); transition: all 0.15s;
  }
  .login-tab.active { background: var(--surface3); color: var(--text); }
  .login-error { background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.2); border-radius: 8px; padding: 10px 12px; font-size: 12px; color: var(--danger); margin-bottom: 16px; }

  /* ── Period Tabs ── */
  .period-tabs { display: flex; gap: 4px; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 3px; }
  .period-tab {
    padding: 5px 12px; border-radius: 6px; border: none; cursor: pointer;
    font-size: 11px; font-weight: 600; font-family: var(--mono);
    background: none; color: var(--text3); transition: all 0.15s;
  }
  .period-tab.active { background: var(--surface3); color: var(--accent); }

  /* ── Section header ── */
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .section-header h2 { font-size: 15px; font-weight: 700; }

  /* ── Search ── */
  .search-wrap { position: relative; }
  .search-wrap input { padding-left: 32px; }
  .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text3); pointer-events: none; }

  /* ── Empty ── */
  .empty { padding: 40px; text-align: center; color: var(--text3); font-size: 13px; }

  /* ── Progress bar ── */
  .progress { height: 6px; background: var(--surface3); border-radius: 3px; overflow: hidden; }
  .progress-bar { height: 100%; border-radius: 3px; transition: width 0.6s; }

  /* ── Sell form ── */
  .sell-item-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .sell-item-info { flex: 1; }
  .sell-item-info p { font-size: 13px; font-weight: 600; }
  .sell-item-info span { font-size: 11px; color: var(--text3); font-family: var(--mono); }
  .qty-control { display: flex; align-items: center; gap: 8px; }
  .qty-btn { background: var(--surface2); border: 1px solid var(--border2); border-radius: 6px; width: 26px; height: 26px; cursor: pointer; color: var(--text); font-size: 14px; display: flex; align-items: center; justify-content: center; }
  .qty-value { font-family: var(--mono); font-size: 13px; min-width: 24px; text-align: center; }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .chart-grid { grid-template-columns: 1fr; }
    .stat-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .sidebar { width: 200px; min-width: 200px; }
    .stat-grid { grid-template-columns: 1fr; }
  }
`;
document.head.appendChild(style);

// ─── Seed Data ──────────────────────────────────────────────────────────────
const SEED_ITEMS = [
  { id: 1, sku: "SKU-001", name: "Wireless Headphones", qty: 45, amount: 89.99, description: "Premium noise-cancelling headphones", sold: 120 },
  { id: 2, sku: "SKU-002", name: "USB-C Hub 7-in-1", qty: 12, amount: 34.99, description: "Multi-port USB hub for laptops", sold: 85 },
  { id: 3, sku: "SKU-003", name: "Mechanical Keyboard", qty: 8, amount: 129.99, description: "RGB backlit 60% layout", sold: 60 },
  { id: 4, sku: "SKU-004", name: "Webcam HD 1080p", qty: 22, amount: 59.99, description: "Full HD webcam with mic", sold: 44 },
  { id: 5, sku: "SKU-005", name: "Mouse Pad XL", qty: 3, amount: 19.99, description: "Extended gaming mouse pad", sold: 200 },
  { id: 6, sku: "SKU-006", name: "LED Desk Lamp", qty: 30, amount: 44.99, description: "Adjustable brightness, USB charging", sold: 75 },
];

const SEED_USERS = [
  { id: 1, name: "Admin User", email: "admin@store.com", password: "admin123", role: "admin", createdAt: "2024-01-10", active: true },
  { id: 2, name: "Jane Doe", email: "jane@store.com", password: "user123", role: "user", createdAt: "2024-02-14", active: true },
  { id: 3, name: "Mark Lee", email: "mark@store.com", password: "user123", role: "user", createdAt: "2024-03-05", active: true },
  { id: 4, name: "Priya Shah", email: "priya@store.com", password: "user123", role: "user", createdAt: "2024-04-20", active: false },
];

// Generate transaction history
const genTxns = () => {
  const txns = [];
  const now = new Date();
  let id = 1;
  for (let d = 29; d >= 0; d--) {
    const date = new Date(now); date.setDate(date.getDate() - d);
    const count = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < count; i++) {
      const item = SEED_ITEMS[Math.floor(Math.random() * SEED_ITEMS.length)];
      const qty = Math.floor(Math.random() * 4) + 1;
      const userId = [2, 3, 4][Math.floor(Math.random() * 3)];
      txns.push({
        id: id++, itemId: item.id, itemName: item.name, sku: item.sku,
        qty, amount: item.amount * qty, userId,
        userName: SEED_USERS.find(u => u.id === userId)?.name || "—",
        date: date.toISOString().split("T")[0],
        time: `${String(8 + Math.floor(Math.random() * 10)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
      });
    }
  }
  return txns;
};

// ─── Icons (text-based) ─────────────────────────────────────────────────────
const I = {
  dash: "⊞", items: "◫", users: "◉", txn: "⇄", notif: "◎", logout: "⌁",
  add: "+", edit: "✎", del: "⊘", search: "⌕", close: "×",
  up: "↑", down: "↓", eye: "◈", sell: "⊕", chart: "▦",
  warn: "⚠", check: "✓", pkg: "◧", money: "◈", fire: "◉",
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmtNum = (n) => new Intl.NumberFormat("en-US").format(n);

// ─── Mini Bar Chart ──────────────────────────────────────────────────────────
function BarChart({ data, color }) {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-wrap">
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
            <div className="bar" style={{ height: `${(d.v / max) * 100}%`, background: color }} />
          </div>
          <span className="bar-label">{d.l}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Mini Line Chart (SVG) ────────────────────────────────────────────────────
function LineChart({ data, color }) {
  const max = Math.max(...data, 1);
  const w = 260, h = 80, pad = 4;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: pad + (1 - v / max) * (h - pad * 2),
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = path + ` L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`;
  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${color.replace("#", "")})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />
        ))}
      </svg>
    </div>
  );
}

// ─── Notification Panel ──────────────────────────────────────────────────────
function NotifPanel({ notifications, onClose, onMarkAll }) {
  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <h4>Notifications</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm btn-secondary" onClick={onMarkAll}>Mark all read</button>
          <button className="modal-close" onClick={onClose}>{I.close}</button>
        </div>
      </div>
      {notifications.length === 0 ? <div className="empty">No notifications</div> : notifications.map(n => (
        <div key={n.id} className={`notif-item ${n.unread ? "unread" : ""}`}>
          <p>{n.message}</p>
          <span>{n.time}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>{I.close}</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ──────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [tab, setTab] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const user = SEED_USERS.find(u => u.email === email && u.password === password && u.role === tab);
    if (!user) { setError("Invalid credentials or wrong role selected."); return; }
    if (!user.active) { setError("Account is inactive. Contact admin."); return; }
    onLogin(user);
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <h1>Stock<span>OS</span></h1>
          <p>Store Management Platform</p>
        </div>
        <div className="login-tabs">
          <button className={`login-tab ${tab === "admin" ? "active" : ""}`} onClick={() => { setTab("admin"); setError(""); setEmail("admin@store.com"); setPassword("admin123"); }}>Admin</button>
          <button className={`login-tab ${tab === "user" ? "active" : ""}`} onClick={() => { setTab("user"); setError(""); setEmail("jane@store.com"); setPassword("user123"); }}>User</button>
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
          Admin: admin@store.com / admin123 &nbsp;|&nbsp; User: jane@store.com / user123
        </p>
      </div>
    </div>
  );
}

// ─── ADMIN: Dashboard ────────────────────────────────────────────────────────
function AdminDashboard({ items, users, txns, period, setPeriod }) {
  const now = new Date();
  const filterTxns = useCallback(() => {
    const cutoff = new Date(now);
    if (period === "daily") cutoff.setDate(cutoff.getDate() - 1);
    else if (period === "weekly") cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setDate(cutoff.getDate() - 30);
    return txns.filter(t => new Date(t.date) >= cutoff);
  }, [txns, period]);

  const filtered = filterTxns();
  const totalRevenue = filtered.reduce((s, t) => s + t.amount, 0);
  const totalSold = filtered.reduce((s, t) => s + t.qty, 0);
  const lowStock = items.filter(i => i.qty <= 5).length;
  const activeUsers = users.filter(u => u.role === "user" && u.active).length;

  // Best selling
  const itemSales = {};
  filtered.forEach(t => { itemSales[t.itemId] = (itemSales[t.itemId] || 0) + t.qty; });
  const best = Object.entries(itemSales).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, qty]) => {
    const item = items.find(i => i.id === +id);
    return { name: item?.name || "—", qty, sku: item?.sku };
  });

  // Per-user transactions
  const userTxns = {};
  filtered.forEach(t => { userTxns[t.userId] = (userTxns[t.userId] || { count: 0, amount: 0, name: t.userName }); userTxns[t.userId].count++; userTxns[t.userId].amount += t.amount; });

  // Chart data – last 7 days or grouped
  const getDays = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - (n - 1 - i)); return d.toISOString().split("T")[0]; });
  const days7 = getDays(7);
  const barData = days7.map(day => ({
    l: new Date(day).toLocaleDateString("en", { weekday: "short" }).slice(0, 2),
    v: txns.filter(t => t.date === day).reduce((s, t) => s + t.amount, 0),
  }));
  const lineData = days7.map(day => txns.filter(t => t.date === day).reduce((s, t) => s + t.qty, 0));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Analytics Dashboard</h2>
          <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>Store performance overview</p>
        </div>
        <div className="period-tabs">
          {["daily", "weekly", "monthly"].map(p => (
            <button key={p} className={`period-tab ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card green">
          <div className="stat-label">Revenue</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{fmt(totalRevenue)}</div>
          <div className="stat-sub">{period} period</div>
          <div className="stat-icon">{I.money}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Units Sold</div>
          <div className="stat-value" style={{ color: "var(--accent2)" }}>{fmtNum(totalSold)}</div>
          <div className="stat-sub">{filtered.length} transactions</div>
          <div className="stat-icon">{I.pkg}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Active Users</div>
          <div className="stat-value" style={{ color: "var(--accent3)" }}>{activeUsers}</div>
          <div className="stat-sub">{users.filter(u => u.role === "user").length} total users</div>
          <div className="stat-icon">{I.users}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Low Stock</div>
          <div className="stat-value" style={{ color: "var(--danger)" }}>{lowStock}</div>
          <div className="stat-sub">items need restock</div>
          <div className="stat-icon">{I.warn}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Total SKUs</div>
          <div className="stat-value" style={{ color: "var(--accent4)" }}>{items.length}</div>
          <div className="stat-sub">{items.reduce((s, i) => s + i.qty, 0)} units in stock</div>
          <div className="stat-icon">{I.items}</div>
        </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="table-card">
          <div className="table-header"><h3>🔥 Best Selling Items</h3></div>
          <table>
            <thead><tr><th>Item</th><th>SKU</th><th>Qty Sold</th></tr></thead>
            <tbody>
              {best.length === 0 ? <tr><td colSpan={3}><div className="empty">No data</div></td></tr> :
                best.map((b, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--text)" }}>{b.name}</td>
                    <td><span className="badge-pill gray">{b.sku}</span></td>
                    <td><span className="badge-pill green">{b.qty}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="table-card">
          <div className="table-header"><h3>👤 Per-User Sales</h3></div>
          <table>
            <thead><tr><th>User</th><th>Transactions</th><th>Revenue</th></tr></thead>
            <tbody>
              {Object.values(userTxns).length === 0 ? <tr><td colSpan={3}><div className="empty">No data</div></td></tr> :
                Object.values(userTxns).map((u, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--text)" }}>{u.name}</td>
                    <td><span className="badge-pill blue">{u.count}</span></td>
                    <td style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(u.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card" style={{ marginTop: 14 }}>
        <div className="table-header"><h3>📦 Stock Levels</h3></div>
        <table>
          <thead><tr><th>SKU</th><th>Item</th><th>Stock</th><th>Level</th></tr></thead>
          <tbody>
            {items.map(item => {
              const pct = Math.min(100, (item.qty / 50) * 100);
              const color = item.qty <= 5 ? "var(--danger)" : item.qty <= 15 ? "var(--warn)" : "var(--accent)";
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
function AdminInventory({ items, setItems }) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "add" | "edit"
  const [form, setForm] = useState({ sku: "", name: "", qty: "", amount: "", description: "" });
  const [editId, setEditId] = useState(null);

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setForm({ sku: `SKU-00${items.length + 1}`, name: "", qty: "", amount: "", description: "" }); setModal("add"); };
  const openEdit = (item) => { setForm({ sku: item.sku, name: item.name, qty: item.qty, amount: item.amount, description: item.description }); setEditId(item.id); setModal("edit"); };
  const save = () => {
    if (!form.sku || !form.name || !form.qty || !form.amount) return;
    if (modal === "add") {
      setItems(prev => [...prev, { id: Date.now(), ...form, qty: +form.qty, amount: +form.amount, sold: 0 }]);
    } else {
      setItems(prev => prev.map(i => i.id === editId ? { ...i, ...form, qty: +form.qty, amount: +form.amount } : i));
    }
    setModal(null);
  };
  const del = (id) => { if (confirm("Delete this item?")) setItems(prev => prev.filter(i => i.id !== id)); };

  const F = ({ label, field, type = "text", placeholder }) => (
    <div className="form-group">
      <label>{label}</label>
      <input type={type} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  return (
    <>
      <div className="section-header">
        <h2>Inventory</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="search-wrap">
            <span className="search-icon">{I.search}</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" style={{ width: 200 }} />
          </div>
          <button className="btn btn-primary" onClick={openAdd}>{I.add} Add Item</button>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th>Price</th><th>Sold</th><th>Description</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7}><div className="empty">No items found</div></td></tr> :
              filtered.map(item => (
                <tr key={item.id}>
                  <td><span className="badge-pill gray">{item.sku}</span></td>
                  <td style={{ color: "var(--text)", fontWeight: 600 }}>{item.name}</td>
                  <td>
                    <span className={`badge-pill ${item.qty <= 5 ? "red" : item.qty <= 15 ? "orange" : "green"}`}>{item.qty}</span>
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{fmt(item.amount)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{item.sold}</td>
                  <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>{I.edit}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(item.id)}>{I.del}</button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "add" ? "Add Item" : "Edit Item"} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save Item</button></>}>
          <div className="form-row"><F label="SKU" field="sku" placeholder="SKU-001" /><F label="Name" field="name" placeholder="Item name" /></div>
          <div className="form-row"><F label="Quantity" field="qty" type="number" placeholder="0" /><F label="Price ($)" field="amount" type="number" placeholder="0.00" /></div>
          <F label="Description" field="description" placeholder="Item description" />
        </Modal>
      )}
    </>
  );
}

// ─── ADMIN: Users ─────────────────────────────────────────────────────────────
function AdminUsers({ users, setUsers }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user", active: true });
  const [editId, setEditId] = useState(null);

  const openAdd = () => { setForm({ name: "", email: "", password: "", role: "user", active: true }); setModal("add"); };
  const openEdit = (u) => { setForm({ name: u.name, email: u.email, password: u.password, role: u.role, active: u.active }); setEditId(u.id); setModal("edit"); };
  const save = () => {
    if (!form.name || !form.email || !form.password) return;
    if (modal === "add") {
      setUsers(prev => [...prev, { id: Date.now(), ...form, createdAt: new Date().toISOString().split("T")[0] }]);
    } else {
      setUsers(prev => prev.map(u => u.id === editId ? { ...u, ...form } : u));
    }
    setModal(null);
  };
  const del = (id) => { if (confirm("Delete this user?")) setUsers(prev => prev.filter(u => u.id !== id)); };
  const toggle = (id) => setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u));

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
                <td><span className={`badge-pill ${u.role === "admin" ? "purple" : "blue"}`}>{u.role}</span></td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{u.createdAt}</td>
                <td>
                  <span className={`badge-pill ${u.active ? "green" : "gray"}`} style={{ cursor: "pointer" }} onClick={() => toggle(u.id)}>
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>{I.edit}</button>
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
            <div className="form-group"><label>Password</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Password" /></div>
            <div className="form-group"><label>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
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
    </>
  );
}

// ─── ADMIN: Transactions ──────────────────────────────────────────────────────
function AdminTransactions({ txns }) {
  const [search, setSearch] = useState("");
  const filtered = txns.filter(t => t.itemName.toLowerCase().includes(search.toLowerCase()) || t.userName.toLowerCase().includes(search.toLowerCase())).slice().reverse().slice(0, 50);

  return (
    <>
      <div className="section-header">
        <h2>All Transactions</h2>
        <div className="search-wrap">
          <span className="search-icon">{I.search}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions…" style={{ width: 220 }} />
        </div>
      </div>
      <div className="table-card">
        <table>
          <thead><tr><th>Date</th><th>Time</th><th>Item</th><th>SKU</th><th>User</th><th>Qty</th><th>Amount</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7}><div className="empty">No transactions</div></td></tr> :
              filtered.map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{t.date}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{t.time}</td>
                  <td style={{ color: "var(--text)", fontWeight: 600 }}>{t.itemName}</td>
                  <td><span className="badge-pill gray">{t.sku}</span></td>
                  <td>{t.userName}</td>
                  <td><span className="badge-pill blue">{t.qty}</span></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{fmt(t.amount)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── USER: Dashboard ──────────────────────────────────────────────────────────
function UserDashboard({ currentUser, items, txns, period, setPeriod }) {
  const myTxns = txns.filter(t => t.userId === currentUser.id);
  const now = new Date();

  const filterMy = useCallback((p) => {
    const cutoff = new Date(now);
    if (p === "daily") cutoff.setDate(cutoff.getDate() - 1);
    else if (p === "weekly") cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setDate(cutoff.getDate() - 30);
    return myTxns.filter(t => new Date(t.date) >= cutoff);
  }, [myTxns]);

  const filtered = filterMy(period);
  const myRevenue = filtered.reduce((s, t) => s + t.amount, 0);
  const myUnits = filtered.reduce((s, t) => s + t.qty, 0);

  const days7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split("T")[0]; });
  const barData = days7.map(day => ({
    l: new Date(day).toLocaleDateString("en", { weekday: "short" }).slice(0, 2),
    v: myTxns.filter(t => t.date === day).reduce((s, t) => s + t.amount, 0),
  }));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>My Dashboard</h2>
          <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>Welcome back, {currentUser.name.split(" ")[0]}</p>
        </div>
        <div className="period-tabs">
          {["daily", "weekly", "monthly"].map(p => (
            <button key={p} className={`period-tab ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card green">
          <div className="stat-label">My Revenue</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{fmt(myRevenue)}</div>
          <div className="stat-sub">{period} period</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Units Sold</div>
          <div className="stat-value" style={{ color: "var(--accent2)" }}>{myUnits}</div>
          <div className="stat-sub">{filtered.length} transactions</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Total Earned</div>
          <div className="stat-value" style={{ color: "var(--accent3)" }}>{fmt(myTxns.reduce((s, t) => s + t.amount, 0))}</div>
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
            const color = item.qty <= 5 ? "var(--danger)" : item.qty <= 15 ? "var(--warn)" : "var(--accent)";
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
        <div className="table-header"><h3>Recent Transactions</h3></div>
        <table>
          <thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
          <tbody>
            {myTxns.slice().reverse().slice(0, 10).length === 0 ? <tr><td colSpan={4}><div className="empty">No transactions yet</div></td></tr> :
              myTxns.slice().reverse().slice(0, 10).map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{t.date} {t.time}</td>
                  <td style={{ color: "var(--text)", fontWeight: 600 }}>{t.itemName}</td>
                  <td><span className="badge-pill blue">{t.qty}</span></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{fmt(t.amount)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── USER: Make a Sale ────────────────────────────────────────────────────────
function UserSell({ currentUser, items, setItems, txns, setTxns, addNotif }) {
  const [cart, setCart] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const available = items.filter(i => i.qty > 0);
  const cartItems = Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => ({ ...items.find(i => i.id === +id), qty }));
  const total = cartItems.reduce((s, i) => s + i.amount * i.qty, 0);

  const set = (id, delta) => {
    const item = items.find(i => i.id === id);
    const cur = cart[id] || 0;
    const next = Math.max(0, Math.min(item.qty, cur + delta));
    setCart(c => ({ ...c, [id]: next }));
  };

  const submit = () => {
    if (cartItems.length === 0) return;
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newTxns = cartItems.map(ci => ({
      id: Date.now() + Math.random(), itemId: ci.id, itemName: ci.name, sku: ci.sku,
      qty: ci.qty, amount: ci.amount * ci.qty, userId: currentUser.id,
      userName: currentUser.name, date, time,
    }));
    setTxns(prev => [...prev, ...newTxns]);
    setItems(prev => prev.map(item => {
      const ci = cartItems.find(c => c.id === item.id);
      return ci ? { ...item, qty: item.qty - ci.qty, sold: item.sold + ci.qty } : item;
    }));
    addNotif({ message: `${currentUser.name} completed a sale of ${fmt(total)}`, time: `${time} today`, unread: true });
    setCart({});
    setConfirm(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <>
      <div className="section-header"><h2>Make a Sale</h2></div>

      {done && (
        <div style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "var(--accent)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          {I.check} Sale completed successfully!
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14 }}>
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
          footer={<><button className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-primary" onClick={submit}>Complete Sale</button></>}>
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
                <td><span className={`badge-pill ${item.qty === 0 ? "red" : item.qty <= 5 ? "orange" : "green"}`}>{item.qty === 0 ? "Out of stock" : item.qty <= 5 ? "Low stock" : "In stock"}</span></td>
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
  const [user, setUser] = useState(null);
  const [items, setItems] = useState(SEED_ITEMS);
  const [users, setUsers] = useState(SEED_USERS);
  const [txns, setTxns] = useState(() => genTxns());
  const [page, setPage] = useState("dashboard");
  const [period, setPeriod] = useState("weekly");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, message: "Jane Doe logged in", time: "09:12 today", unread: true },
    { id: 2, message: "Mark Lee logged in", time: "08:45 today", unread: true },
    { id: 3, message: "Priya Shah completed a $432.00 sale", time: "Yesterday", unread: false },
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const addNotif = (n) => setNotifications(prev => [{ id: Date.now(), ...n }, ...prev]);
  const markAll = () => setNotifications(prev => prev.map(n => ({ ...n, unread: false })));

  const handleLogin = (u) => {
    setUser(u);
    setPage("dashboard");
    if (u.role === "user") {
      addNotif({ message: `${u.name} logged in`, time: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }) + " today", unread: true });
    }
  };

  const handleLogout = () => { setUser(null); setPage("dashboard"); setNotifOpen(false); };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const isAdmin = user.role === "admin";
  const avatarColor = isAdmin ? "rgba(199,125,255,0.15)" : "rgba(0,144,255,0.15)";
  const avatarText = user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const adminNav = [
    { id: "dashboard", label: "Dashboard", icon: I.dash },
    { id: "inventory", label: "Inventory", icon: I.items },
    { id: "users", label: "Users", icon: I.users },
    { id: "transactions", label: "Transactions", icon: I.txn },
  ];
  const userNav = [
    { id: "dashboard", label: "Dashboard", icon: I.dash },
    { id: "sell", label: "Make a Sale", icon: I.sell },
    { id: "store", label: "Store Items", icon: I.items },
  ];
  const nav = isAdmin ? adminNav : userNav;

  const topbarTitles = { dashboard: "Dashboard", inventory: "Inventory", users: "Users", transactions: "Transactions", sell: "Make a Sale", store: "Store Items" };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Stock<span>OS</span></h1>
          <p>Store Management Platform</p>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: avatarColor, color: isAdmin ? "var(--accent4)" : "var(--accent2)" }}>{avatarText}</div>
          <div className="sidebar-user-info">
            <p>{user.name.split(" ")[0]}</p>
            <span>{user.role}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Navigation</div>
            {nav.map(n => (
              <div key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
                <span>{n.icon}</span> {n.label}
              </div>
            ))}
          </div>
        </nav>
        <div className="sidebar-logout">
          <button className="logout-btn" onClick={handleLogout}><span>{I.logout}</span> Logout</button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <span className="topbar-title">{topbarTitles[page]}</span>
          <div className="topbar-right">
            {isAdmin && (
              <div style={{ position: "relative" }}>
                <button className="notif-btn" onClick={() => setNotifOpen(o => !o)}>{I.notif}
                  {unreadCount > 0 && <span className="notif-dot" />}
                </button>
                {notifOpen && <NotifPanel notifications={notifications} onClose={() => setNotifOpen(false)} onMarkAll={markAll} />}
              </div>
            )}
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text3)" }}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        <div className="content">
          {page === "dashboard" && isAdmin && <AdminDashboard items={items} users={users} txns={txns} period={period} setPeriod={setPeriod} />}
          {page === "inventory" && isAdmin && <AdminInventory items={items} setItems={setItems} />}
          {page === "users" && isAdmin && <AdminUsers users={users} setUsers={setUsers} />}
          {page === "transactions" && isAdmin && <AdminTransactions txns={txns} />}
          {page === "dashboard" && !isAdmin && <UserDashboard currentUser={user} items={items} txns={txns} period={period} setPeriod={setPeriod} />}
          {page === "sell" && !isAdmin && <UserSell currentUser={user} items={items} setItems={setItems} txns={txns} setTxns={setTxns} addNotif={addNotif} />}
          {page === "store" && !isAdmin && <UserStore items={items} />}
        </div>
      </div>
    </div>
  );
}
