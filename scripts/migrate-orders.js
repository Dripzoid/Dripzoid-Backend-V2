import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ======================================================
   MIGRATION
====================================================== */

async function migrateOrders() {
  console.log(
    "🚀 Starting orders migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  /* =========================================
     FETCH ORDERS
  ========================================= */

  const orders = await sqliteDb.all(`
    SELECT *
    FROM orders
  `);

  console.log(
    `📦 Found ${orders.length} orders`
  );

  /* =========================================
     PRELOAD USERS
  ========================================= */

  const users =
    await prisma.user.findMany();

  const userMap = new Map();

  for (const user of users) {
    userMap.set(user.email, user.id);
  }

  /* =========================================
     PRELOAD ADDRESSES
  ========================================= */

  const addresses =
    await prisma.address.findMany();

  const addressMap = new Map();

  for (const address of addresses) {
    addressMap.set(address.id, address.id);
  }

  let migrated = 0;
  let skipped = 0;

  for (const order of orders) {
    try {
      /* =====================================
         USER
      ===================================== */

      const oldUser =
        await sqliteDb.get(
          `
          SELECT *
          FROM users
          WHERE id = ?
        `,
          [order.user_id]
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
         DUPLICATE CHECK
      ===================================== */

      if (
  order.razorpay_order_id ||
  order.razorpay_payment_id
) {
  const existing =
    await prisma.order.findFirst({
      where: {
        OR: [
          {
            razorpayOrderId:
              order.razorpay_order_id ||
              undefined,
          },
          {
            razorpayPaymentId:
              order.razorpay_payment_id ||
              undefined,
          },
        ],
      },
    });

  if (existing) {
    skipped++;
    continue;
  }
}

      /* =====================================
         CREATE ORDER
      ===================================== */

      await prisma.order.create({
        data: {
          userId: newUserId,

          totalAmount:
            Number(
              order.total_amount
            ) || 0,

          paymentMethod:
            order.payment_method ||
            null,

          status:
            order.status || "pending",

          shippingAddress:
            order.shipping_address ||
            null,

          paymentDetails:
            order.payment_details ||
            null,

          expectedDeliveryFrom:
            order.expected_delivery_from
              ? new Date(
                  order.expected_delivery_from
                )
              : null,

          expectedDeliveryTo:
            order.expected_delivery_to
              ? new Date(
                  order.expected_delivery_to
                )
              : null,

          deliveryDate:
            order.delivery_date
              ? new Date(
                  order.delivery_date
                )
              : null,

          razorpayOrderId:
            order.razorpay_order_id ||
            null,

          razorpayPaymentId:
            order.razorpay_payment_id ||
            null,

          razorpayAmount:
            Number(
              order.razorpay_amount
            ) || null,

          shiprocketOrderId:
            order.shiprocket_order_id ||
            null,

          itemsJson:
            order.items_json || null,

          shippingJson:
            order.shipping_json ||
            null,

          createdAt:
            order.created_at
              ? new Date(
                  order.created_at
                )
              : new Date(),

          updatedAt:
            order.updated_at
              ? new Date(
                  order.updated_at
                )
              : new Date(),
        },
      });

      migrated++;

      console.log(
        `✅ Order migrated`
      );
    } catch (error) {
      console.error(
        `❌ Failed order ${order.id}`,
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

migrateOrders();