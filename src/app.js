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

app.set("trust proxy", 1);

/* =====================================================
   🌍 CORS
===================================================== */

const defaultAllowedOrigins = [
  "https://dripzoid.yuvatejasainadh.me",
  "https://dripzoidv2.vercel.app",
  "https://dripzoid.com",
  "https://www.dripzoid.com",
  "https://dripzoid-frontend.onrender.com",
  "https://askdrip-frontend.onrender.com",
  "https://ask.dripzoid.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

const envClient = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",")
      .map((u) => u.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  : [];

const allowedOrigins = Array.from(
  new Set([...defaultAllowedOrigins, ...envClient])
);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server) without Origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Disallow unauthorized origins without throwing an internal server error (HTTP 500)
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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
