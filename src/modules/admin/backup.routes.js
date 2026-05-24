import express from "express";

import multer from "multer";

import {
  adminAuth,
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
    fileSize: 1024 * 1024 * 100,
  },
});

/* =====================================================
   EXPORT DATABASE
===================================================== */

router.get(
  "/export-db",
  adminAuth,
  exportDatabase
);

/* =====================================================
   IMPORT DATABASE
===================================================== */

router.post(
  "/import-db",
  adminAuth,
  upload.single("sqlfile"),
  importDatabase
);

export default router;
