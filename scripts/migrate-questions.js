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

async function migrateQuestions() {
  console.log(
    "🚀 Starting questions migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  /* =========================================
     FETCH QUESTIONS
  ========================================= */

  const questions =
    await sqliteDb.all(`
      SELECT *
      FROM questions
    `);

  console.log(
    `📦 Found ${questions.length} questions`
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

  for (const question of questions) {
    try {
      /* =====================================
         USER
      ===================================== */

      const newUserId =
        userMap.get(question.userId);

      if (!newUserId) {
        console.log(
          `⚠️ User missing for question ${question.id}`
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
          [question.productId]
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
        await prisma.question.findFirst({
          where: {
            userId: newUserId,
            productId: newProductId,
            text: question.text,
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      /* =====================================
         CREATE QUESTION
      ===================================== */

      await prisma.question.create({
        data: {
          userId: newUserId,

          productId: newProductId,

          text: question.text,

          createdAt:
            question.createdAt
              ? new Date(
                  question.createdAt
                )
              : new Date(),
        },
      });

      migrated++;

      console.log(
        `✅ Question migrated`
      );
    } catch (error) {
      console.error(
        `❌ Failed question ${question.id}`,
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

migrateQuestions();