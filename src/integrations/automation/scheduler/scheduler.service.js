import prisma from "../../../lib/prisma.js";

/* =====================================================
   GET PENDING AUTOMATION EVENTS
===================================================== */

export async function getPendingAutomationEvents() {
  return prisma.automationEvent.findMany({
    where: {
      status: "pending",
      retryCount: {
        lt: 5,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

/* =====================================================
   UPDATE AUTOMATION EVENT
===================================================== */

export async function updateAutomationEvent(
  eventId,
  data
) {
  return prisma.automationEvent.update({
    where: {
      id: eventId,
    },
    data,
  });
}

export async function getAutomationEventById(
  eventId
) {
  return prisma.automationEvent.findUnique({
    where: {
      id: eventId,
    },
  });
}
