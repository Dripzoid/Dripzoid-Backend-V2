import prisma from "../../../lib/prisma.js";

/* ======================================================
   GET ALL APPLICATIONS
====================================================== */

export async function getApplicationsService() {
  const applications =
    await prisma.application.findMany({
      orderBy: {
        appliedAt: "desc",
      },
    });

  return applications;
}

/* ======================================================
   GET SINGLE APPLICATION
====================================================== */

export async function getApplicationByIdService(
  id
) {
  const application =
    await prisma.application.findUnique({
      where: {
        id,
      },
    });

  if (!application) {
    throw new Error(
      "Application not found"
    );
  }

  return application;
}

/* ======================================================
   CREATE APPLICATION
====================================================== */

export async function createApplicationService({
  jobId,
  name,
  email,
  phone,
  portfolio,
  cover,
  resume_url,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !jobId ||
    !name ||
    !email
  ) {
    throw new Error(
      "Missing required fields"
    );
  }

  /* =========================
     CREATE APPLICATION
  ========================= */

  const application =
    await prisma.application.create({
      data: {
        jobId,

        name,

        email:
          email
            .toLowerCase()
            .trim(),

        phone:
          phone || "",

        portfolio:
          portfolio || null,

        cover:
          cover || null,

        resumeUrl:
          resume_url || null,
      },
    });

  return {
    success: true,

    message:
      "Application submitted successfully",

    applicationId:
      application.id,
  };
}

/* ======================================================
   UPDATE APPLICATION STATUS
====================================================== */

export async function updateApplicationStatusService(
  id,
  status
) {
  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingApplication =
    await prisma.application.findUnique({
      where: {
        id,
      },
    });

  if (!existingApplication) {
    throw new Error(
      "Application not found"
    );
  }

  /* =========================
     UPDATE STATUS
  ========================= */

  await prisma.application.update({
    where: {
      id,
    },

    data: {
      status,
    },
  });

  return true;
}

/* ======================================================
   DELETE APPLICATION
====================================================== */

export async function deleteApplicationService(
  id
) {
  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingApplication =
    await prisma.application.findUnique({
      where: {
        id,
      },
    });

  if (!existingApplication) {
    throw new Error(
      "Application not found"
    );
  }

  /* =========================
     DELETE APPLICATION
  ========================= */

  await prisma.application.delete({
    where: {
      id,
    },
  });

  return true;
}