import express from "express";

import {
  getJobs,
  getJobBySlug,
  createJob,
  updateJob,
  deleteJob,
} from "./jobs.controller.js";

import { adminAuth }
from "../../../middlewares/admin.middleware.js";

const router = express.Router();

/* =========================================
   🌍 PUBLIC ROUTES
========================================= */

// 📦 Get all jobs
router.get(
  "/",
  getJobs
);

// 📦 Get single job
router.get(
  "/:slug",
  getJobBySlug
);

/* =========================================
   🔐 ADMIN ROUTES
========================================= */

// ➕ Create job
router.post(
  "/",
  adminAuth,
  createJob
);

// ✏️ Update job
router.put(
  "/:id",
  adminAuth,
  updateJob
);

// ❌ Delete job
router.delete(
  "/:id",
  adminAuth,
  deleteJob
);

export default router;