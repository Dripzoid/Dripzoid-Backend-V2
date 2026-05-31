import prisma from "../../lib/prisma.js";

import {
  generateEmbedding,
} from "./embedding.service.js";

export async function searchProductsSemantic(
  query,
  limit = 10
) {

  const embedding =
    await generateEmbedding(
      query
    );

  const vector =
    `[${embedding.join(",")}]`;

  const matches =
    await prisma.$queryRawUnsafe(
      `
      SELECT
        product_id,
        embedding <=> $1::vector
          AS distance
      FROM product_vectors
      ORDER BY distance ASC
      LIMIT $2
      `,
      vector,
      limit
    );

  const ids =
    matches.map(
      (m) => m.product_id
    );

  if (!ids.length) {
    return [];
  }

  const products =
    await prisma.product.findMany({
      where: {
        id: {
          in: ids,
        },
      },

      include: {
        category: true,
        sizes: true,
      },
    });

  return products;
}
