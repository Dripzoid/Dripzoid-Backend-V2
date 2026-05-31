import prisma from "../src/lib/prisma.js";

import {
  generateEmbedding,
} from "../src/modules/semantic-search/embedding.service.js";

import {
  buildProductEmbeddingText,
} from "../src/modules/semantic-search/semantic.utils.js";

async function saveEmbedding(
  productId,
  embedding
) {
  const vector =
    `[${embedding.join(",")}]`;

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO product_vectors (
      product_id,
      embedding
    )
    VALUES (
      $1::uuid,
      $2::vector
    )
    ON CONFLICT (product_id)
    DO UPDATE SET
      embedding =
        EXCLUDED.embedding,
      updated_at =
        NOW()
    `,
    productId,
    vector
  );
}

async function main() {

  console.log(
    "Fetching products..."
  );

  const products =
    await prisma.product.findMany({
      include: {
        category: true,
      },
    });

  console.log(
    `Found ${products.length} products`
  );

  let processed = 0;
  let failed = 0;

  for (const product of products) {

    try {

      const text =
        buildProductEmbeddingText(
          product
        );

      const embedding =
        await generateEmbedding(
          text
        );

      if (
        !embedding ||
        !embedding.length
      ) {
        throw new Error(
          "Empty embedding returned"
        );
      }

      await saveEmbedding(
        product.id,
        embedding
      );

      processed++;

      console.log(
        `[${processed}/${products.length}] ${product.name}`
      );

    } catch (error) {

      failed++;

      console.error(
        `❌ Failed: ${product.name}`
      );

      console.error(
        error.message
      );
    }
  }

  console.log("\n");

  console.log(
    "=================================="
  );

  console.log(
    `✅ Generated: ${processed}`
  );

  console.log(
    `❌ Failed: ${failed}`
  );

  console.log(
    "=================================="
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
