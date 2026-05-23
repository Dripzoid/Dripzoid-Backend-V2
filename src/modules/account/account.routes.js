import express from "express";

import { authenticateToken as authMiddleware } from "../../middlewares/auth.middleware.js";

import {
  deleteController,
  exportController,
  getActivityController,
  getSettings,
  toggle2FAController,
  updateNotificationController,
  updatePassword,
} from "./account.controller.js";

const router =
  express.Router();

router.get(
  "/",
  authMiddleware,
  getSettings
);

router.post(
  "/change-password",
  authMiddleware,
  updatePassword
);

router.post(
  "/toggle-2fa",
  authMiddleware,
  toggle2FAController
);

router.post(
  "/notifications",
  authMiddleware,
  updateNotificationController
);

router.get(
  "/export",
  authMiddleware,
  exportController
);

router.delete(
  "/delete",
  authMiddleware,
  deleteController
);

router.get(
  "/activity",
  authMiddleware,
  getActivityController
);

export default router;