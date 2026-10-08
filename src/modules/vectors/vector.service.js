import prisma from "../../lib/prisma.js";

export async function getAllProductVectors() {
  const vectors = await prisma.productVector.findMany({
    include: {
      product: true,
    },
  });

  return vectors
    .filter((item) => item.product)
    .map((item) => ({
      product_id: item.productId,
      embedding: item.embedding,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        description: item.product.description,
        categoryId: item.product.categoryId,
        subcategory: item.product.subcategory,
        price: item.product.price,
        originalPrice: item.product.originalPrice,
        images: item.product.images,
        colors: item.product.colors,
        rating: item.product.rating,
        stock: item.product.stock,
        sold: item.product.sold,
        featured: item.product.featured,
        createdAt: item.product.createdAt,
        updatedAt: item.product.updatedAt,
      },
    }));
}

export async function getAllKBVectors() {
  const vectors = await prisma.kBVector.findMany();

  return vectors.map((item) => ({
    id: item.id,
    route: item.route,
    fact_text: item.factText,
    embedding: item.embedding,
  }));
}
