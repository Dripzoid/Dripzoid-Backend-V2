import express from "express";

import authMiddleware from "../authAdmin.js";

import {
  exportDatabase,
  importDatabase,
} from "../../controllers/admin/backup.controller.js";

import multer from "multer";

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
  authMiddleware,
  exportDatabase
);

/* =====================================================
   IMPORT DATABASE
===================================================== */

router.post(
  "/import-db",
  upload.single("sqlfile"),
  importDatabase
);

export default router;
