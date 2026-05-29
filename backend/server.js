import { initDB } from "./db.js";
import { createApp } from "./src/app.js";
import { env } from "./src/config/env.js";

// Initialize database and start server
const startServer = async () => {
  try {
    await initDB();
    console.log("Database initialized successfully.");

    const app = createApp();
    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
