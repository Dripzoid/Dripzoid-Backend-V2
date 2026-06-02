import prisma from "../../lib/prisma.js";

export async function getAllProductVectors() {

  const vectors =
    await prisma.$queryRaw`
      SELECT
        product_id,
        embedding::text AS embedding
      FROM product_vectors
    `;

  return vectors.map(
    (vector) => ({
      product_id:
        vector.product_id,

      embedding:
        JSON.parse(
          vector.embedding
        )
    })
  );
}
