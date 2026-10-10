import prisma from "../../lib/prisma.js";
import { generateEmbedding } from "./embedding.service.js";
import { formatProduct } from "../products/product.utils.js";

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function searchProductsSemantic(query, limit = 10, filters = {}) {
  if (!query || typeof query !== "string" || !query.trim()) {
    return [];
  }

  const safeLimit = Math.min(Number(limit) || 10, 50);

  const embedding = await generateEmbedding(query);

  if (!embedding || !embedding.length) {
    return [];
  }

  const productVectors = await prisma.productVector.findMany({
    include: {
      product: {
        include: {
          category: true,
          sizes: true,
        },
      },
    },
  });

  let scored = productVectors
    .filter((pv) => pv.product && pv.embedding && pv.embedding.length)
    .map((pv) => {
      const similarity = cosineSimilarity(embedding, pv.embedding);
      const distance = 1 - similarity;
      return {
        ...pv.product,
        semanticScore: similarity,
        semanticDistance: distance,
      };
    });

  const { minPrice, maxPrice, category } = filters || {};
  if (minPrice !== undefined && !isNaN(Number(minPrice)) && Number(minPrice) > 0) {
    scored = scored.filter((p) => Number(p.price) >= Number(minPrice));
  }
  if (maxPrice !== undefined && !isNaN(Number(maxPrice)) && Number(maxPrice) > 0 && Number(maxPrice) < 999999) {
    scored = scored.filter((p) => Number(p.price) <= Number(maxPrice));
  }
  if (category && String(category).trim().toLowerCase() !== "all") {
    const catLower = String(category).trim().toLowerCase();
    scored = scored.filter(
      (p) =>
        String(p.category?.category || "").toLowerCase() === catLower ||
        String(p.category || "").toLowerCase() === catLower ||
        String(p.subcategory || "").toLowerCase() === catLower ||
        String(p.category?.subcategory || "").toLowerCase() === catLower
    );
  }

  scored.sort((a, b) => b.semanticScore - a.semanticScore);
  const topResults = scored.slice(0, safeLimit);

  return Promise.all(
    topResults.map(async (prod) => {
      const formatted = await formatProduct(prod);
      return {
        ...formatted,
        image: formatted.images?.[0] || prod.image || null,
        semanticScore: prod.semanticScore,
        semanticDistance: prod.semanticDistance,
      };
    })
  );
}
