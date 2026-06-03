import prisma from "../../lib/prisma.js";

export async function getAllProductVectors() {
  const products =
    await prisma.$queryRaw`
      SELECT
        pv.product_id,
        pv.embedding::text AS embedding,

        p.name,
        p.slug,
        p.description,
        p.category_id,
        p.subcategory_id,
        p.actual_price,
        p.discount_price,
        p.images,
        p.gender,
        p.color

      FROM product_vectors pv
      INNER JOIN Product p
        ON p.id = pv.product_id
    `;

  return products.map((product) => ({
    product_id: product.product_id,

    embedding: JSON.parse(
      product.embedding
    ),

    product: {
      id: product.product_id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category_id: product.category_id,
      subcategory_id: product.subcategory_id,
      actual_price: product.actual_price,
      discount_price: product.discount_price,
      images: product.images,
      gender: product.gender,
      color: product.color
    }
  }));
}

export async function getAllKBVectors() {
  const vectors =
    await prisma.$queryRaw`
      SELECT
        route,
        fact_text,
        embedding
      FROM kb_vectors
    `;

  return vectors;
}
