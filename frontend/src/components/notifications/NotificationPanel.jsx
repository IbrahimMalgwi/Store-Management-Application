import { icons as I } from "../../constants/icons";

export function NotificationPanel({ notifications, onClose, onMarkAll }) {
  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <h4>Notifications</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm btn-secondary" onClick={onMarkAll}>Mark all read</button>
          <button className="modal-close" onClick={onClose}>{I.close}</button>
        </div>
      </div>
      {notifications.length === 0 ? <div className="empty">No notifications</div> : notifications.map((notification) => (
        <div key={notification.id} className={`notif-item ${notification.unread ? "unread" : ""}`}>
          {notification.type === "low_stock" && <span className={`badge-pill ${notification.resolved ? "gray" : "red"}`}>{notification.resolved ? "Restocked" : "Low stock"}</span>}
          <p>{notification.message}</p>
          <span>{notification.time}</span>
        </div>
      ))}
    </div>
  );
}
