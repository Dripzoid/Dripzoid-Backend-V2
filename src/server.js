import "dotenv/config";

import { app } from "./app.js";

import prisma from "./lib/prisma.js";

/* =====================================================
   🚀 START SERVER
===================================================== */

const PORT =
  process.env.PORT || 5000;

async function startServer() {
  try {
    /* =========================
       DATABASE CONNECTION
    ========================= */

    await prisma.$connect();

    console.log(
      "✅ PostgreSQL connected successfully"
    );

    console.log(
      "🔥 Server starting..."
    );

    /* =========================
       START EXPRESS SERVER
    ========================= */

    app.listen(PORT, () => {
      console.log(
        `🚀 Server running on port ${PORT}`
      );
    });
  } catch (err) {
    console.error(
      "❌ Failed to start server:",
      err
    );

    process.exit(1);
  }
}

/* =====================================================
   START APP
===================================================== */

startServer();

/* =====================================================
   GRACEFUL SHUTDOWN
===================================================== */

async function shutdown() {
  console.log(
    "\n🛑 Shutting down server..."
  );

  try {
    await prisma.$disconnect();

    console.log(
      "✅ PostgreSQL disconnected"
    );

    process.exit(0);
  } catch (err) {
    console.error(
      "❌ Error during shutdown:",
      err
    );

    process.exit(1);
  }
}

process.on(
  "SIGINT",
  shutdown
);

process.on(
  "SIGTERM",
  shutdown
);