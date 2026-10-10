import {
  pipeline,
} from "@xenova/transformers";

let extractor = null;
const embeddingCache = new Map();
const MAX_CACHE_SIZE = 500;

async function getExtractor() {
  if (!extractor) {
    console.log("Loading MiniLM...");
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }

  return extractor;
}

export async function generateEmbedding(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const cacheKey = normalized.toLowerCase();
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }

  const model = await getExtractor();

  const output = await model(normalized, {
    pooling: "mean",
    normalize: true,
  });

  const embedding = Array.from(output.data);

  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }
  embeddingCache.set(cacheKey, embedding);

  return embedding;
}
