import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateApplications() {
  console.log(
    "🚀 Starting applications migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  /* =========================================
     FETCH APPLICATIONS
  ========================================= */

  const applications =
    await sqliteDb.all(`
      SELECT *
      FROM applications
    `);

  console.log(
    `📦 Found ${applications.length} applications`
  );

  let migrated = 0;
  let skipped = 0;

  for (const app of applications) {
    try {
      /* =====================================
         VERIFY JOB
      ===================================== */

      const job =
        await prisma.job.findUnique({
          where: {
            id: app.job_id,
          },
        });

      if (!job) {
        skipped++;
        continue;
      }

      /* =====================================
         DUPLICATE CHECK
      ===================================== */

      const existing =
        await prisma.application.findUnique({
          where: {
            id: app.id,
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      /* =====================================
         CREATE APPLICATION
      ===================================== */

      await prisma.application.create({
        data: {
          id: app.id,

          jobId: app.job_id,

          name: app.name,

          email: app.email,

          phone: app.phone || null,

          portfolio:
            app.portfolio || null,

          cover:
            app.cover || null,

          resumeUrl:
            app.resume_url || null,

          status:
            app.status || "Applied",

          certificateGenerated:
            Boolean(
              app.certificate_generated
            ),

          appliedAt:
            app.applied_at
              ? new Date(
                  app.applied_at
                )
              : new Date(),
        },
      });

      migrated++;

      console.log(
        `✅ Application migrated: ${app.email}`
      );
    } catch (error) {
      console.error(
        `❌ Failed application ${app.id}`,
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

migrateApplications();