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

async function migrateReviews() {
  console.log(
    "🚀 Starting reviews migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  /* =========================================
     FETCH REVIEWS
  ========================================= */

  const reviews = await sqliteDb.all(`
    SELECT *
    FROM reviews
  `);

  console.log(
    `📦 Found ${reviews.length} reviews`
  );

  /* =========================================
     PRELOAD PRODUCTS
  ========================================= */

  const products =
    await prisma.product.findMany();

  const productMap = new Map();

  for (const product of products) {
    productMap.set(
      product.slug,
      product.id
    );
  }

  /* =========================================
     PRELOAD USERS
  ========================================= */

  const users =
    await prisma.user.findMany();

  const userMap = new Map();

  for (const user of users) {
    userMap.set(user.email, user.id);
  }

  let migrated = 0;
  let skipped = 0;

  for (const review of reviews) {
    try {
      /* =====================================
         USER
      ===================================== */

      const newUserId =
        userMap.get(review.userId);

      if (!newUserId) {
        console.log(
          `⚠️ User missing for review ${review.id}`
        );

        skipped++;
        continue;
      }

      /* =====================================
         PRODUCT
      ===================================== */

      const oldProduct =
        await sqliteDb.get(
          `
          SELECT *
          FROM products
          WHERE id = ?
        `,
          [review.productId]
        );

      if (!oldProduct) {
        skipped++;
        continue;
      }

      const slug =
        `${generateSlug(oldProduct.name)}-${oldProduct.id}`;

      const newProductId =
        productMap.get(slug);

      if (!newProductId) {
        skipped++;
        continue;
      }

      /* =====================================
         DUPLICATE CHECK
      ===================================== */

      const existing =
        await prisma.review.findFirst({
          where: {
            userId: newUserId,
            productId: newProductId,
            text: review.text || "",
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      /* =====================================
         CREATE REVIEW
      ===================================== */

      await prisma.review.create({
        data: {
          userId: newUserId,

          productId: newProductId,

          rating:
            Number(review.rating) || 0,

          text: review.text || null,

          imageUrl:
            review.imageUrl || null,

          createdAt:
            review.createdAt
              ? new Date(
                  review.createdAt
                )
              : new Date(),
        },
      });

      migrated++;

      console.log(
        `✅ Review migrated`
      );
    } catch (error) {
      console.error(
        `❌ Failed review ${review.id}`,
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

migrateReviews();