import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { startPendingOrderExpiryCron } from "./cron/pendingOrderExpiry.cron.js";
import routes from "./routes/index.js";

import { configureGoogleAuth }
  from "./modules/auth/oauth.js";

import {
  errorHandler,
} from "./errors/errorHandler.js";

const app = express();

/* =====================================================
   🌍 CORS
===================================================== */

app.use(
  cors({
    origin: [
      "https://askdrip-frontend.onrender.com",
      "https://dripzoid.com",
      "https://ask.dripzoid.com",
    ],

    credentials: true,
  })
);

/* =====================================================
   📦 BODY PARSERS
===================================================== */

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());

/* =====================================================
   🔐 PASSPORT AUTH
===================================================== */

configureGoogleAuth();

app.use(
  passport.initialize()
);

startPendingOrderExpiryCron();

/* =====================================================
   🩺 HEALTH CHECK
===================================================== */

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,

    message:
      "Dripzoid Backend Running 🚀",
  });
});

/* =====================================================
   🚀 API ROUTES
===================================================== */

app.get(
  "/loaderio-2a0666c7eba53ab1698f28c2124462c8.txt",
  (req, res) => {
    res.type("text/plain");
    res.send("loaderio-2a0666c7eba53ab1698f28c2124462c8");
  }
);

app.use("/api", routes);

/* =====================================================
   ❌ 404 HANDLER
===================================================== */

app.use((req, res) => {

  return res.status(404).json({
    success: false,

    message:
      `Route not found: ${req.originalUrl}`,
  });
});

/* =====================================================
   🚨 GLOBAL ERROR HANDLER
===================================================== */

app.use(errorHandler);

export { app };
