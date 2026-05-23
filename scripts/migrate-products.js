import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ======================================================
   HELPERS
====================================================== */

function safeJsonParse(value) {
  try {
    if (!value) return null;

    if (typeof value === "object") {
      return value;
    }

    if (value === "[object Object]") {
      return null;
    }

    return JSON.parse(value);
  } catch {
    return null;
  }
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseArray(value) {
  if (!value) return [];

  // already array
  if (Array.isArray(value)) {
    return value;
  }

  // try JSON
  const parsed = safeJsonParse(value);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  // comma-separated fallback
  if (typeof value === "string") {
    return value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [];
}

/* ======================================================
   MIGRATION
====================================================== */

async function migrateProducts() {
  console.log(
    "🚀 Starting products migration..."
  );

  const sqliteDb = await open({
    filename: "./src/data/dripzoid.db",
    driver: sqlite3.Database,
  });

  const products = await sqliteDb.all(`
    SELECT *
    FROM products
  `);

  console.log(
    `📦 Found ${products.length} products`
  );

  let migrated = 0;
  let skipped = 0;

  for (const product of products) {
    try {
      const slug =
  `${generateSlug(product.name)}-${product.id}`;

      // prevent duplicates
      const existing =
        await prisma.product.findUnique({
          where: { slug },
        });

      if (existing) {
        skipped++;
        continue;
      }

      /* =========================================
         CATEGORY MAPPING
      ========================================= */

      let categoryId = null;

      if (
        product.category &&
        product.subcategory
      ) {
        const category =
          await prisma.category.findFirst({
            where: {
              category:
                product.category,
              subcategory:
                product.subcategory,
            },
          });

        if (category) {
          categoryId = category.id;
        }
      }

      /* =========================================
         IMAGES
      ========================================= */

      const images = parseArray(
        product.images
      );

      /* =========================================
         COLORS
      ========================================= */

      const colors = parseArray(
        product.colors
      );

      /* =========================================
         CREATE PRODUCT
      ========================================= */

      const createdProduct =
        await prisma.product.create({
          data: {
            name: product.name,

            slug,

            categoryId,

            subcategory:
              product.subcategory || null,

            description:
              product.description || null,

            price:
              Number(product.price) || 0,

            originalPrice:
              Number(
                product.originalPrice
              ) || null,

            actualPrice:
              Number(
                product.actualPrice
              ) || null,

            rating:
              Number(product.rating) ||
              null,

            stock:
              Number(product.stock) || 0,

            sold:
              Number(product.sold) || 0,

            featured: Boolean(
              product.featured
            ),

            images,

            colors,

            createdAt:
              product.updated_at
                ? new Date(
                    product.updated_at
                  )
                : new Date(),

            updatedAt:
              product.updated_at
                ? new Date(
                    product.updated_at
                  )
                : new Date(),
          },
        });

      /* =========================================
         PRODUCT SIZES
      ========================================= */

      const sizes = parseArray(
        product.sizes
      );

      for (const size of sizes) {
        try {
          await prisma.productSize.create({
            data: {
              productId:
                createdProduct.id,

              size:
                typeof size === "string"
                  ? size
                  : size?.size || "Free",

              stock:
                typeof size === "object"
                  ? Number(size.stock) || 0
                  : 0,
            },
          });
        } catch {}
      }

      migrated++;

      console.log(
        `✅ Migrated product: ${product.name}`
      );
    } catch (error) {
      console.error(
        `❌ Failed product ${product.id}`,
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

migrateProducts();