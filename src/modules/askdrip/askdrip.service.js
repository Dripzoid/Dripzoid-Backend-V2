import prisma from "../../lib/prisma.js";

/* =========================
   CREATE CONVERSATION
========================= */

export const createConversationService =
  async (userId, title = "New Chat") => {
    return prisma.conversation.create({
      data: {
        userId,
        title,
      },
    });
  };

/* =========================
   GET CONVERSATIONS
========================= */

export const getConversationsService =
  async (userId) => {
    return prisma.conversation.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  };

/* =========================
   GET MESSAGES
========================= */

export const getMessagesService =
  async (
    conversationId,
    userId
  ) => {
    const conversation =
      await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

    if (!conversation) {
      throw new Error(
        "Conversation not found"
      );
    }

    return prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  };

/* =========================
   CREATE MESSAGE
========================= */

export const createMessageService =
  async ({
    conversationId,
    role,
    content,
    model,
    tokenCount,
    userId,
  }) => {
    const conversation =
      await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

    if (!conversation) {
      throw new Error(
        "Conversation not found"
      );
    }

    const message =
      await prisma.message.create({
        data: {
          conversationId,
          role,
          content,
          model,
          tokenCount,
        },
      });

    await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return message;
  };

/* =========================
   DELETE CONVERSATION
========================= */

export const deleteConversationService =
  async (
    conversationId,
    userId
  ) => {
    const conversation =
      await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

    if (!conversation) {
      throw new Error(
        "Conversation not found"
      );
    }

    await prisma.conversation.delete({
      where: {
        id: conversationId,
      },
    });

    return true;
  };
