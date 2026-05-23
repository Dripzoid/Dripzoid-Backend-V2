import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ======================================================
   HELPERS
====================================================== */

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/* ======================================================
   MIGRATION
====================================================== */

async function migrateProductSizes() {
  console.log(
    "🚀 Starting product sizes migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  const sizes = await sqliteDb.all(`
    SELECT *
    FROM product_sizes
  `);

  console.log(
    `📦 Found ${sizes.length} product sizes`
  );

  let migrated = 0;
  let skipped = 0;

  for (const item of sizes) {
    try {
      /* =========================================
         GET OLD PRODUCT
      ========================================= */

      const oldProduct =
        await sqliteDb.get(
          `
          SELECT *
          FROM products
          WHERE id = ?
        `,
          [item.product_id]
        );

      if (!oldProduct) {
        console.log(
          `⚠️ Product missing for size ${item.id}`
        );

        skipped++;
        continue;
      }

      /* =========================================
         GENERATE SAME SLUG USED DURING PRODUCT MIGRATION
      ========================================= */

      const slug =
        `${generateSlug(oldProduct.name)}-${oldProduct.id}`;

      /* =========================================
         FIND MIGRATED PRODUCT
      ========================================= */

      const newProduct =
        await prisma.product.findUnique({
          where: { slug },
        });

      if (!newProduct) {
        console.log(
          `⚠️ Migrated product missing: ${slug}`
        );

        skipped++;
        continue;
      }

      /* =========================================
         DUPLICATE CHECK
      ========================================= */

      const existing =
        await prisma.productSize.findFirst({
          where: {
            productId: newProduct.id,
            size: item.size,
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      /* =========================================
         CREATE PRODUCT SIZE
      ========================================= */

      await prisma.productSize.create({
        data: {
          productId: newProduct.id,

          size: item.size,

          stock:
            Number(item.stock) || 0,
        },
      });

      migrated++;

      console.log(
        `✅ Migrated size ${item.size} for ${oldProduct.name}`
      );
    } catch (error) {
      console.error(
        `❌ Failed size ${item.id}`,
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

migrateProductSizes();