import express from "express";

import {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplicationStatus,
  deleteApplication,
} from "./applications.controller.js";

import { adminAuth }
from "../../../middlewares/admin.middleware.js";

import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

/* =========================================
   📁 RESUME UPLOAD CONFIG
========================================= */

const uploadDir = "uploads/resumes";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const unique =
      Date.now() +
      path.extname(file.originalname);

    cb(null, unique);
  },
});

const upload = multer({
  storage,
});

/* =========================================
   🌍 PUBLIC ROUTES
========================================= */

// ➕ Apply for job
router.post(
  "/apply",
  upload.single("resume"),
  createApplication
);

/* =========================================
   🔐 ADMIN ROUTES
========================================= */

// 📦 Get all applications
router.get(
  "/",
  adminAuth,
  getApplications
);

// 📦 Get single application
router.get(
  "/:id",
  adminAuth,
  getApplicationById
);

// ✏️ Update status
router.put(
  "/:id/status",
  adminAuth,
  updateApplicationStatus
);

// ❌ Delete application
router.delete(
  "/:id",
  adminAuth,
  deleteApplication
);

export default router;