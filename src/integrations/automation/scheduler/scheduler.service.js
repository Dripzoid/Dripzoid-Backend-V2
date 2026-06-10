import prisma from "../../../config/prisma.js";

export async function getPendingScheduledTasks() {
  return prisma.scheduledTask.findMany({
    where: {
      status: "pending",
      executeAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      executeAt: "asc",
    },
  });
}

export async function updateScheduledTask(
  taskId,
  data
) {
  return prisma.scheduledTask.update({
    where: {
      id: taskId,
    },
    data,
  });
}

export async function createAutomationLog(
  data
) {
  return prisma.automationLog.create({
    data,
  });
}
