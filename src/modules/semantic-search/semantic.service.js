import prisma from "../../lib/prisma.js";
import { generateEmbedding } from "./embedding.service.js";

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

export async function searchProductsSemantic(query, limit = 10) {
  if (!query?.trim()) {
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

  const scored = productVectors
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

  scored.sort((a, b) => b.semanticScore - a.semanticScore);
  return scored.slice(0, safeLimit);
}
