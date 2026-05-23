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

async function migrateOrderItems() {
  console.log(
    "🚀 Starting order items migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  /* =========================================
     FETCH ORDER ITEMS
  ========================================= */

  const orderItems =
    await sqliteDb.all(`
      SELECT *
      FROM order_items
    `);

  console.log(
    `📦 Found ${orderItems.length} order items`
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
     PRELOAD ORDERS
  ========================================= */

  const orders =
    await prisma.order.findMany();

  let migrated = 0;
  let skipped = 0;

  for (const item of orderItems) {
    try {
      /* =====================================
         OLD ORDER
      ===================================== */

      const oldOrder =
        await sqliteDb.get(
          `
          SELECT *
          FROM orders
          WHERE id = ?
        `,
          [item.order_id]
        );

      if (!oldOrder) {
        skipped++;
        continue;
      }

      /* =====================================
         FIND NEW ORDER
      ===================================== */

      let newOrder = null;

      // Razorpay match
      if (
        oldOrder.razorpay_order_id
      ) {
        newOrder =
          await prisma.order.findFirst({
            where: {
              razorpayOrderId:
                oldOrder.razorpay_order_id,
            },
          });
      }

      // fallback
      if (!newOrder) {
        newOrder =
          await prisma.order.findFirst({
            where: {
              totalAmount:
                Number(
                  oldOrder.total_amount
                ) || 0,
            },
          });
      }

      if (!newOrder) {
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
        await prisma.orderItem.findFirst({
          where: {
            orderId: newOrder.id,
            productId: newProductId,
            selectedSize:
              item.selectedSize ||
              null,
            selectedColor:
              item.selectedColor ||
              null,
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      /* =====================================
         CREATE ORDER ITEM
      ===================================== */

      await prisma.orderItem.create({
        data: {
          orderId: newOrder.id,

          productId: newProductId,

          quantity:
            Number(item.quantity) || 1,

          unitPrice:
            Number(item.unit_price) ||
            0,

          price:
            Number(item.price) || 0,

          selectedSize:
            item.selectedSize || null,

          selectedColor:
            item.selectedColor ||
            null,
        },
      });

      migrated++;

      console.log(
        `✅ Order item migrated`
      );
    } catch (error) {
      console.error(
        `❌ Failed order item ${item.id}`,
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

migrateOrderItems();