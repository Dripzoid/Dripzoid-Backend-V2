// modules/admin/stats/stats.routes.js

import express from "express";

import authMiddleware from "../authAdmin.js";

import {
  getAdminStats,
} from "./stats.controller.js";

const router = express.Router();

/* ==================================================
   ADMIN STATS
================================================== */

router.get(
  "/stats",
  authMiddleware,
  getAdminStats
);

export default router;
