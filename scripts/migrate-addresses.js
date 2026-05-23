import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateAddresses() {
  console.log("🚀 Starting address migration...");

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  const addresses = await sqliteDb.all(`
    SELECT *
    FROM addresses
  `);

  console.log(
    `📦 Found ${addresses.length} addresses`
  );

  let migrated = 0;
  let skipped = 0;

  for (const address of addresses) {
    try {
      // Find migrated user by old email mapping
      const oldUser = await sqliteDb.get(
        `
        SELECT *
        FROM users
        WHERE id = ?
      `,
        [address.user_id]
      );

      if (!oldUser) {
        console.log(
          `⚠️ User not found for address ${address.id}`
        );
        skipped++;
        continue;
      }

      const newUser =
        await prisma.user.findUnique({
          where: {
            email: oldUser.email,
          },
        });

      if (!newUser) {
        console.log(
          `⚠️ Migrated user missing: ${oldUser.email}`
        );
        skipped++;
        continue;
      }

      await prisma.address.create({
        data: {
          userId: newUser.id,

          label: address.label || null,

          name: address.name || null,

          phone: address.phone || null,

          line1: address.line1 || null,
          line2: address.line2 || null,

          city: address.city || null,
          state: address.state || null,

          pincode:
            address.pincode || null,

          country:
            address.country || "India",

          isDefault: Boolean(
            address.is_default
          ),

          createdAt:
            address.created_at
              ? new Date(
                  address.created_at
                )
              : new Date(),
        },
      });

      migrated++;

      console.log(
        `✅ Address migrated for ${oldUser.email}`
      );
    } catch (error) {
      console.error(
        `❌ Failed address ${address.id}`,
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

migrateAddresses();