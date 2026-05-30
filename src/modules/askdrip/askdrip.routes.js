import { Router } from "express";

import {
  createConversation,
  getConversations,
  getMessages,
  createMessage,
  deleteConversation,
} from "./askdrip.controller.js";

import {
  authenticateToken,
} from "../../middlewares/auth.middleware.js";

import {
  verifyInternalApi,
} from "../../middlewares/internalApi.middleware.js";

const router = Router();

/* =========================
   CONVERSATIONS
========================= */

router.post(
  "/conversations",
  authenticateToken,
  createConversation
);

router.get(
  "/conversations",
  authenticateToken,
  getConversations
);

router.delete(
  "/conversations/:conversationId",
  authenticateToken,
  deleteConversation
);

/* =========================
   MESSAGES
========================= */

router.get(
  "/conversations/:conversationId/messages",
  authenticateToken,
  getMessages
);

router.post(
  "/messages",
  verifyInternalApi,
  createMessage
);

export default router;
