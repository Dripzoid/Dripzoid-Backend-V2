import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateJobs() {
  console.log(
    "🚀 Starting jobs migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  /* =========================================
     FETCH JOBS
  ========================================= */

  const jobs = await sqliteDb.all(`
    SELECT *
    FROM jobs
  `);

  console.log(
    `📦 Found ${jobs.length} jobs`
  );

  let migrated = 0;
  let skipped = 0;

  for (const job of jobs) {
    try {
      /* =====================================
         DUPLICATE CHECK
      ===================================== */

      const existing =
        await prisma.job.findUnique({
          where: {
            slug: job.slug,
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      /* =====================================
         CREATE JOB
      ===================================== */

      await prisma.job.create({
        data: {
          id: job.id,

          slug: job.slug,

          title: job.title,

          type: job.type,

          location:
            job.location || null,

          department:
            job.department || null,

          duration:
            job.duration || null,

          stipend:
            job.stipend || null,

          status:
            job.status || "Open",

          description:
            job.description || null,

          createdAt:
            job.created_at
              ? new Date(
                  job.created_at
                )
              : new Date(),
        },
      });

      migrated++;

      console.log(
        `✅ Job migrated: ${job.title}`
      );
    } catch (error) {
      console.error(
        `❌ Failed job ${job.id}`,
        error.message
      );
    }
  }

  console.log("\n====================");
  console.log(`✅ Migrated: ${migrated}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log("====================");

  await sqliteDb.close();
  await prisma.$disconnect();
}

migrateJobs();