import prisma from "../../lib/prisma.js";

/* =====================================================
   ❌ DELETE SPECIFIC SESSION
===================================================== */

export async function deleteSession(
  userId,
  sessionId
) {
  /* =========================
     CHECK SESSION
  ========================= */

  const existingSession =
    await prisma.userSession.findFirst({
      where: {
        id: sessionId,

        userId,
      },
    });

  if (!existingSession) {
    throw new Error(
      "Session not found"
    );
  }

  /* =========================
     DELETE SESSION
  ========================= */

  await prisma.userSession.delete({
    where: {
      id: sessionId,
    },
  });

  return true;
}

/* =====================================================
   ❌ DELETE ALL SESSIONS
===================================================== */

export async function deleteAllSessions(
  userId
) {
  const result =
    await prisma.userSession.deleteMany({
      where: {
        userId,
      },
    });

  return {
    success: true,

    deleted:
      result.count,
  };
}

/* =====================================================
   📦 GET USER SESSIONS
===================================================== */

export async function getUserSessions(
  userId
) {
  const sessions =
    await prisma.userSession.findMany({
      where: {
        userId,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      select: {
        id: true,

        device: true,

        ip: true,

        lastActive: true,

        createdAt: true,
      },
    });

  return (
    sessions || []
  ).map((session) => ({
    id:
      session.id,

    device:
      session.device,

    ip:
      session.ip,

    last_active:
      session.lastActive,

    created_at:
      session.createdAt,
  }));
}