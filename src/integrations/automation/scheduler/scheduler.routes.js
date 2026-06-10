import express from "express";

import {
  getPendingScheduledTasks,
  updateScheduledTask,
  createAutomationLog,
} from "./scheduler.controller.js";

const router = express.Router();

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
