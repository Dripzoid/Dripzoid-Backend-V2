import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateCertificates() {
  console.log(
    "🚀 Starting certificates migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  /* =========================================
     FETCH CERTIFICATES
  ========================================= */

  const certificates =
    await sqliteDb.all(`
      SELECT *
      FROM certificates
    `);

  console.log(
    `📦 Found ${certificates.length} certificates`
  );

  /* =========================================
     PRELOAD APPLICATIONS
  ========================================= */

  const applications =
    await prisma.application.findMany({
      select: {
        id: true,
      },
    });

  const applicationSet = new Set(
    applications.map((a) => a.id)
  );

  let migrated = 0;
  let skipped = 0;

  for (const cert of certificates) {
    try {
      /* =====================================
         VERIFY APPLICATION
      ===================================== */

      if (
        cert.application_id &&
        !applicationSet.has(
          cert.application_id
        )
      ) {
        console.log(
          `⚠️ Missing application for certificate ${cert.id}`
        );

        skipped++;
        continue;
      }

      /* =====================================
         DUPLICATE CHECK
      ===================================== */

      const existing =
        await prisma.certificate.findUnique({
          where: {
            id: cert.id,
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      /* =====================================
         CREATE CERTIFICATE
      ===================================== */

      await prisma.certificate.create({
  data: {
    id: cert.id,

    application: cert.application_id
      ? {
          connect: {
            id: cert.application_id,
          },
        }
      : undefined,

    // use SQLite primary key
    certificateId: cert.id,

    internName:
      cert.intern_name || null,

    role: cert.role || null,

    startDate:
      cert.start_date
        ? new Date(cert.start_date)
        : null,

    endDate:
      cert.end_date
        ? new Date(cert.end_date)
        : null,

    issueDate:
      cert.issue_date
        ? new Date(cert.issue_date)
        : null,

    certificateUrl:
      cert.certificate_url || null,

    qrUrl:
      cert.qr_url || null,

    createdAt:
      cert.created_at
        ? new Date(cert.created_at)
        : new Date(),
  },
});

      migrated++;

      console.log(
        `✅ Certificate migrated: ${cert.id}`
      );
    } catch (error) {
      console.error(
        `❌ Failed certificate ${cert.id}`,
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

migrateCertificates();