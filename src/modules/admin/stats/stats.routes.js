// modules/admin/stats/stats.routes.js

import express from "express";
import {
  adminAuth,
} from "../../../middlewares/admin.middleware.js";

import {
  getAdminStats,
} from "./stats.controller.js";

const router = express.Router();

/* ==================================================
   ADMIN STATS
================================================== */

router.get(
  "/stats",
  adminAuth,
  getAdminStats
);

export default router;
