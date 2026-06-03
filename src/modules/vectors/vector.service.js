import prisma from "../../lib/prisma.js";

export async function getAllProductVectors() {
  const products =
    await prisma.$queryRaw`
      SELECT
       SELECT
  pv.product_id,
  pv.embedding::text AS embedding,

  p.id,
  p.name,
  p.slug,
  p.description,
  p."categoryId",
  p.subcategory,
  p."actualPrice",
  p."originalPrice",
  p.images,
  p.colors,
  p.rating,
  p.stock,
  p.sold,
  p.featured,
  p."createdAt",
  p."updatedAt"

FROM product_vectors pv
INNER JOIN "Product" p
  ON p.id = pv.product_id::text
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
