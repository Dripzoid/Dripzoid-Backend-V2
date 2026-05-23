import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateSlides() {
  console.log(
    "🚀 Starting slides migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  /* =========================================
     FETCH SLIDES
  ========================================= */

  const slides = await sqliteDb.all(`
    SELECT *
    FROM slides
  `);

  console.log(
    `📦 Found ${slides.length} slides`
  );

  let migrated = 0;
  let skipped = 0;

  for (const slide of slides) {
    try {
      /* =====================================
         DUPLICATE CHECK
      ===================================== */

      const existing =
        await prisma.slide.findFirst({
          where: {
            imageUrl:
              slide.image_url,
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      /* =====================================
         CREATE SLIDE
      ===================================== */

      await prisma.slide.create({
        data: {
          name: slide.name,

          imageUrl:
            slide.image_url,

          link:
            slide.link || null,

          orderIndex:
            Number(
              slide.order_index
            ) || 0,

          isDeleted: Boolean(
            slide.is_deleted
          ),

          createdAt:
            slide.created_at
              ? new Date(
                  slide.created_at
                )
              : new Date(),

          updatedAt:
            slide.updated_at
              ? new Date(
                  slide.updated_at
                )
              : new Date(),
        },
      });

      migrated++;

      console.log(
        `✅ Slide migrated: ${slide.name}`
      );
    } catch (error) {
      console.error(
        `❌ Failed slide ${slide.id}`,
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

migrateSlides();