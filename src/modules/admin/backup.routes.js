import express from "express";

import multer from "multer";

import {
  authenticateToken,
} from "../../middlewares/auth.middleware.js";

import {
  requireAdmin,
} from "../../middlewares/admin.middleware.js";

import {
  exportDatabase,
  importDatabase,
} from "./backup.controller.js";

const router = express.Router();

/* =====================================================
   MULTER CONFIG
===================================================== */

const upload = multer({
  dest: "uploads/",

  limits: {
    fileSize: 1024 * 1024 * 100, // 100MB
  },
});

/* =====================================================
   EXPORT DATABASE
===================================================== */

router.get(
  "/export-db",

  authenticateToken,

  requireAdmin,

  exportDatabase
);

/* =====================================================
   IMPORT DATABASE
===================================================== */

router.post(
  "/import-db",

  authenticateToken,

  requireAdmin,

  upload.single("sqlfile"),

  importDatabase
);

export default router;
