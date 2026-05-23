import prisma from "../../lib/prisma.js";

export async function logActivity(
  userId,
  action
) {
  return prisma.userActivity.create(
    {
      data: {
        userId,
        action,
      },
    }
  );
}