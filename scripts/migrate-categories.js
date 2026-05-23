import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateCategories() {
  console.log("🚀 Starting categories migration...");

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  const categories = await sqliteDb.all(`
    SELECT *
    FROM categories
  `);

  console.log(
    `📦 Found ${categories.length} categories`
  );

  let migrated = 0;
  let skipped = 0;

  for (const category of categories) {
    try {
      // Prevent duplicates
      const existing =
        await prisma.category.findFirst({
          where: {
            category: category.category,
            subcategory:
              category.subcategory,
          },
        });

      if (existing) {
        skipped++;
        continue;
      }

      let parentCategory = null;

      // Handle parent category relation
      if (category.parent_id) {
        const oldParent =
          await sqliteDb.get(
            `
            SELECT *
            FROM categories
            WHERE id = ?
          `,
            [category.parent_id]
          );

        if (oldParent) {
          parentCategory =
            await prisma.category.findFirst({
              where: {
                category:
                  oldParent.category,
                subcategory:
                  oldParent.subcategory,
              },
            });
        }
      }

      await prisma.category.create({
        data: {
          category: category.category,

          subcategory:
            category.subcategory,

          slug:
            category.slug ||
            `${category.category}-${category.subcategory}`
              .toLowerCase()
              .replace(/\s+/g, "-"),

          status:
            category.status || "active",

          sortOrder:
            category.sort_order || 0,

          parentId:
            parentCategory?.id || null,

          metadata: (() => {
  try {
    if (!category.metadata) return null;

    // Already object
    if (typeof category.metadata === "object") {
      return category.metadata;
    }

    // JSON string
    if (typeof category.metadata === "string") {
      return JSON.parse(category.metadata);
    }

    return null;
  } catch {
    return null;
  }
})(),

          isDeleted: Boolean(
            category.is_deleted
          ),

          createdAt:
            category.created_at
              ? new Date(
                  category.created_at
                )
              : new Date(),

          updatedAt:
            category.updated_at
              ? new Date(
                  category.updated_at
                )
              : new Date(),
        },
      });

      migrated++;

      console.log(
        `✅ Migrated category: ${category.subcategory}`
      );
    } catch (error) {
      console.error(
        `❌ Failed category ${category.id}`,
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

migrateCategories();