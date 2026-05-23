import prisma from "../lib/prisma.js";

/* =====================================================
   📝 LOG USER ACTIVITY
===================================================== */

export async function logUserActivity({
  userId,
  action,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !userId ||
    !action
  ) {
    throw new Error(
      "userId and action are required"
    );
  }

  /* =========================
     CREATE ACTIVITY
  ========================= */

  return prisma.userActivity.create({
    data: {
      userId,

      action,
    },
  });
}