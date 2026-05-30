import { Router } from "express";

import {
  createConversation,
  getConversations,
  getMessages,
  createMessage,
  deleteConversation,
} from "./askdrip.controller.js";

import {
  verifyInternalApi,
} from "../../middlewares/internalApi.middleware.js";

const router = Router();

/* =========================
   CONVERSATIONS
========================= */

router.post(
  "/conversations",
  verifyInternalApi,
  createConversation
);

router.get(
  "/conversations",
  verifyInternalApi,
  getConversations
);

router.delete(
  "/conversations/:conversationId",
  verifyInternalApi,
  deleteConversation
);

/* =========================
   MESSAGES
========================= */

router.get(
  "/conversations/:conversationId/messages",
  verifyInternalApi,
  getMessages
);

router.post(
  "/messages",
  verifyInternalApi,
  createMessage
);

export default router;
