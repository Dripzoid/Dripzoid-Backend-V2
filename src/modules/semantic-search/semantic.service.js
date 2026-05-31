import prisma from "../../lib/prisma.js";

import {
  generateEmbedding,
} from "./embedding.service.js";

export async function searchProductsSemantic(
  query,
  limit = 10
) {

  if (!query?.trim()) {
    return [];
  }

  const safeLimit = Math.min(
    Number(limit) || 10,
    50
  );

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
      safeLimit
    );

  if (!matches.length) {
    return [];
  }

  const ids =
    matches.map(
      (match) =>
        match.product_id
    );

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

  const productMap =
    new Map(
      products.map(
        (product) => [
          product.id,
          product,
        ]
      )
    );

  return matches
    .map((match) => {

      const product =
        productMap.get(
          match.product_id
        );

      if (!product) {
        return null;
      }

      return {
        ...product,

        semanticScore:
          1 -
          Number(
            match.distance
          ),

        semanticDistance:
          Number(
            match.distance
          ),
      };
    })
    .filter(Boolean);
}
