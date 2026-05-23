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

async function migrateCartItems() {
  console.log(
    "🚀 Starting cart items migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  /* =========================================
     FETCH DATA
  ========================================= */

  const cartItems =
    await sqliteDb.all(`
      SELECT *
      FROM cart_items
    `);

  console.log(
    `📦 Found ${cartItems.length} cart items`
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

  for (const item of cartItems) {
    try {
      /* =====================================
         OLD USER
      ===================================== */

      const oldUser =
        await sqliteDb.get(
          `
          SELECT *
          FROM users
          WHERE id = ?
        `,
          [item.user_id]
        );

      if (!oldUser) {
        skipped++;
        continue;
      }

      const newUserId =
        userMap.get(oldUser.email);

      if (!newUserId) {
        skipped++;
        continue;
      }

      /* =====================================
         OLD PRODUCT
      ===================================== */

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
        await prisma.cartItem.findFirst({
          where: {
            userId: newUserId,
            productId: newProductId,
            size: item.size || null,
            color: item.color || null,
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      /* =====================================
         CREATE
      ===================================== */

      await prisma.cartItem.create({
        data: {
          userId: newUserId,

          productId: newProductId,

          size: item.size || null,

          color: item.color || null,

          quantity:
            Number(item.quantity) || 1,

          addedAt:
            item.added_at
              ? new Date(
                  item.added_at
                )
              : new Date(),
        },
      });

      migrated++;

      console.log(
        `✅ Cart item migrated`
      );
    } catch (error) {
      console.error(
        `❌ Failed cart item ${item.id}`,
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

migrateCartItems();