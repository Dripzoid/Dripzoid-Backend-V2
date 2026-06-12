import express from "express";

import {
  getPendingAutomationEvents,
  updateAutomationEvent,
  getAutomationEventById,
} from "./scheduler.controller.js";

import { verifyInternalKey }
  from "../../../middlewares/automation.middleware.js";

const router = express.Router();

router.use(verifyInternalKey);

router.get(
  "/automation-events/pending",
  getPendingAutomationEvents
);

router.get(
  "/automation-events/:id",
  getAutomationEventById
);

router.patch(
  "/automation-events/:id",
  updateAutomationEvent
);
export default router;
