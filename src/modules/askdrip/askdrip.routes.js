import { Router } from "express";

import {
  createConversation,
  getConversations,
  getMessages,
  createMessage,
  deleteConversation,
} from "./askdrip.controller.js";

import {
 authenticateToken as requireAuth,
} from "../../middlewares/auth.middleware.js";

const router = Router();

/* =========================
   CONVERSATIONS
========================= */

router.post(
  "/conversations",
  requireAuth,
  createConversation
);

router.get(
  "/conversations",
  requireAuth,
  getConversations
);

router.delete(
  "/conversations/:conversationId",
  requireAuth,
  deleteConversation
);

/* =========================
   MESSAGES
========================= */

router.get(
  "/conversations/:conversationId/messages",
  requireAuth,
  getMessages
);

router.post(
  "/messages",
  requireAuth,
  createMessage
);

export default router;
