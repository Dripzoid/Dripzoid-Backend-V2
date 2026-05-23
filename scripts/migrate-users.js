import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateUsers() {
  console.log("🚀 Starting users migration...");

  // Open SQLite database
  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db", // CHANGE THIS PATH
    driver: sqlite3.Database,
  });

  // Fetch users
  const users = await sqliteDb.all(`
    SELECT * FROM users
  `);

  console.log(`📦 Found ${users.length} users`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      // Check existing
      const exists = await prisma.user.findUnique({
        where: {
          email: user.email,
        },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await prisma.user.create({
        data: {
          name: user.name || null,

          email: user.email,

          phone: user.phone || null,

          password: user.password,

          gender: user.gender || null,

          dob: user.dob
            ? new Date(user.dob)
            : null,

          isAdmin: Boolean(user.is_admin),

          createdAt: user.created_at
            ? new Date(user.created_at)
            : new Date(),
        },
      });

      migrated++;

      console.log(
        `✅ Migrated: ${user.email}`
      );
    } catch (error) {
      console.error(
        `❌ Failed: ${user.email}`,
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

migrateUsers();