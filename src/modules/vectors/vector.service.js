import prisma from "../../lib/prisma.js";

export async function getAllProductVectors() {

  const products =
    await prisma.$queryRaw`
      SELECT
        pv.product_id,
        pv.embedding::text AS embedding,

        p.id,
        p.name,
        p.slug,
        p.description,
        p."categoryId",
        p.subcategory,
        p."price",
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

  return products.map(
    (product) => ({
      product_id:
        product.product_id,

      embedding:
        JSON.parse(
          product.embedding
        ),

      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        categoryId: product.categoryId,
        subcategory: product.subcategory,
        actualPrice: product.actualPrice,
        originalPrice: product.originalPrice,
        images: product.images,
        colors: product.colors,
        rating: product.rating,
        stock: product.stock,
        sold: product.sold,
        featured: product.featured,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    })
  );
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
