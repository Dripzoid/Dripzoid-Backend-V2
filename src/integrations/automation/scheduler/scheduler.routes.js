import express from "express";

import {
  getPendingScheduledTasks,
  updateScheduledTask,
  createAutomationLog,
} from "./scheduler.controller.js";

import { verifyInternalKey }
  from "../../../middlewares/automation.middleware.js";

const router = express.Router();

router.use(verifyInternalKey);

router.get(
  "/scheduled-tasks/pending",
  getPendingScheduledTasks
);

router.patch(
  "/scheduled-tasks/:id",
  updateScheduledTask
);

router.post(
  "/automation-logs",
  createAutomationLog
);

export default router;
