import prisma from "../../../lib/prisma.js";

/* ======================================================
   GET ALL JOBS
====================================================== */

export async function getJobsService() {
  const jobs =
    await prisma.job.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

  return jobs;
}

/* ======================================================
   GET SINGLE JOB BY SLUG
====================================================== */

export async function getJobBySlugService(
  slug
) {
  const job =
    await prisma.job.findUnique({
      where: {
        slug,
      },
    });

  if (!job) {
    throw new Error(
      "Job not found"
    );
  }

  return job;
}

/* ======================================================
   CREATE JOB
====================================================== */

export async function createJobService({
  id,
  slug,
  title,
  type,
  location,
  department,
  duration,
  stipend,
  status,
  description,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !id ||
    !slug ||
    !title ||
    !type
  ) {
    throw new Error(
      "Missing required fields"
    );
  }

  /* =========================
     CHECK EXISTING JOB
  ========================= */

  const existingJob =
    await prisma.job.findFirst({
      where: {
        OR: [
          { id },
          { slug },
        ],
      },
    });

  if (existingJob) {
    throw new Error(
      "Job already exists"
    );
  }

  /* =========================
     CREATE JOB
  ========================= */

  const job =
    await prisma.job.create({
      data: {
        id,

        slug:
          slug
            .toLowerCase()
            .trim(),

        title,

        type,

        location:
          location || null,

        department:
          department || null,

        duration:
          duration || null,

        stipend:
          stipend || null,

        status:
          status || "Open",

        description:
          description || null,
      },
    });

  return {
    success: true,

    message:
      "Job created successfully",

    job,
  };
}

/* ======================================================
   UPDATE JOB
====================================================== */

export async function updateJobService(
  id,
  data
) {
  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingJob =
    await prisma.job.findUnique({
      where: {
        id,
      },
    });

  if (!existingJob) {
    throw new Error(
      "Job not found"
    );
  }

  /* =========================
     UPDATE JOB
  ========================= */

  const updatedJob =
    await prisma.job.update({
      where: {
        id,
      },

      data: {
        title:
          data.title,

        type:
          data.type,

        location:
          data.location,

        department:
          data.department,

        duration:
          data.duration,

        stipend:
          data.stipend,

        status:
          data.status,

        description:
          data.description,
      },
    });

  return updatedJob;
}

/* ======================================================
   DELETE JOB
====================================================== */

export async function deleteJobService(
  id
) {
  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingJob =
    await prisma.job.findUnique({
      where: {
        id,
      },
    });

  if (!existingJob) {
    throw new Error(
      "Job not found"
    );
  }

  /* =========================
     DELETE JOB
  ========================= */

  await prisma.job.delete({
    where: {
      id,
    },
  });

  return true;
}