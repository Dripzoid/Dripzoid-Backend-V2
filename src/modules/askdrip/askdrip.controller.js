import {
  createConversationService,
  getConversationsService,
  getMessagesService,
  createMessageService,
  deleteConversationService,
} from "./askdrip.service.js";

/* =========================
   CREATE CONVERSATION
========================= */

export const createConversation =
  async (req, res) => {
    try {
      const conversation =
        await createConversationService(
          req.user.id,
          req.body?.title
        );

      return res.status(201).json({
        success: true,
        conversation,
      });
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message:
          "Failed to create conversation",
      });
    }
  };

/* =========================
   GET CONVERSATIONS
========================= */

export const getConversations =
  async (req, res) => {
    try {
      const conversations =
        await getConversationsService(
          req.user.id
        );

      return res.json({
        success: true,
        conversations,
      });
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch conversations",
      });
    }
  };

/* =========================
   GET MESSAGES
========================= */

export const getMessages =
  async (req, res) => {
    try {
      const messages =
        await getMessagesService(
          req.params.conversationId,
          req.user.id
        );

      return res.json({
        success: true,
        messages,
      });
    } catch (err) {
      console.error(err);

      return res.status(404).json({
        success: false,
        message: err.message,
      });
    }
  };

/* =========================
   CREATE MESSAGE
========================= */

export const createMessage =
  async (req, res) => {
    try {
      const {
        conversationId,
        role,
        content,
        model,
        tokenCount,
      } = req.body;

      const message =
        await createMessageService({
          conversationId,
          role,
          content,
          model,
          tokenCount,
          userId: req.user.id,
        });

      return res.status(201).json({
        success: true,
        message,
      });
    } catch (err) {
      console.error(err);

      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  };

/* =========================
   DELETE CONVERSATION
========================= */

export const deleteConversation =
  async (req, res) => {
    try {
      await deleteConversationService(
        req.params.conversationId,
        req.user.id
      );

      return res.json({
        success: true,
        message:
          "Conversation deleted successfully",
      });
    } catch (err) {
      console.error(err);

      return res.status(404).json({
        success: false,
        message: err.message,
      });
    }
  };
