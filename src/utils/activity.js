import prisma from "../lib/prisma.js";

/* =====================================================
   📝 INSERT USER ACTIVITY
===================================================== */

export async function insertUserActivity(
  userId,
  action
) {
  const dedupeSeconds =
    3;

  /* =========================
     VALIDATION
  ========================= */

  if (
    !userId ||
    !action
  ) {
    return null;
  }

  /* =========================
     GET LAST ACTIVITY
  ========================= */

  const lastActivity =
    await prisma.userActivity.findFirst({
      where: {
        userId,

        action,
      },

      orderBy: {
        createdAt:
          "desc",
      },
    });

  /* =========================
     DEDUPE CHECK
  ========================= */

  if (lastActivity) {
    const now =
      Date.now();

    const lastTime =
      new Date(
        lastActivity.createdAt
      ).getTime();

    const diffSeconds =
      Math.floor(
        (now -
          lastTime) /
          1000
      );

    if (
      diffSeconds <=
      dedupeSeconds
    ) {
      return null;
    }
  }

  /* =========================
     INSERT ACTIVITY
  ========================= */

  const activity =
    await prisma.userActivity.create({
      data: {
        userId,

        action,
      },
    });

  return activity.id;
}