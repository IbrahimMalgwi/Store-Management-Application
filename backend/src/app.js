import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env.js";

import authRoutes from "../routes/auth.js";
import inventoryRoutes from "../routes/inventory.js";
import userRoutes from "../routes/users.js";
import transactionRoutes from "../routes/transactions.js";
import notificationRoutes from "../routes/notifications.js";
import adminRoutes from "../routes/admin.js";
import settingsRoutes from "../routes/settings.js";
import auditRoutes from "../routes/audit.js";
import customerRoutes from "../routes/customers.js";

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: false,
    })
  );
  app.use(express.json());
  app.use(morgan("dev"));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/customers", customerRoutes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "An unexpected server error occurred" });
  });

  return app;
};
