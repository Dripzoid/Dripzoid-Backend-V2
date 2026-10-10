import {
  generateEmbedding,
} from "./embedding.service.js";
import {
  searchProductsSemantic,
} from "./semantic.service.js";
import {
  getProductsService,
} from "../products/product.service.js";

export async function embedText(
  req,
  res
) {
  try {
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Text is required",
      });
    }

    const embedding = await generateEmbedding(text);

    return res.json({
      success: true,
      embedding,
    });
  } catch (error) {
    console.error("Embedding generation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to generate embedding",
    });
  }
}

function withTimeout(promise, ms = 4000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export async function searchProducts(req, res) {
  try {
    const rawQuery =
      req.query.query ||
      req.query.q ||
      req.query.search ||
      req.body?.query ||
      req.body?.text;

    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
    const limit = req.query.limit || req.body?.limit || 10;
    const { minPrice, maxPrice, category } = req.query;

    if (!query) {
      console.log("[Search] Received empty search query");
      if (req.query.format === "array") {
        return res.status(200).json([]);
      }
      return res.status(200).json({
        success: true,
        count: 0,
        products: [],
        data: [],
      });
    }

    let products = [];
    let semanticErrorOccurred = false;

    try {
      products = await withTimeout(
        searchProductsSemantic(query, limit, {
          minPrice,
          maxPrice,
          category,
        }),
        4000
      );
      if (products.length > 0) {
        console.log(`[Search] Semantic search returned ${products.length} products for "${query}"`);
      }
    } catch (semanticError) {
      semanticErrorOccurred = true;
      console.warn(
        `[Search] Semantic search error for "${query}": ${semanticError.message}. Falling back to keyword search.`
      );
      products = [];
    }

    // If semantic search produced zero results (e.g. empty vector table or no similarity match),
    // seamlessly fall back to keyword search so queries like "saree" return matching catalog items
    if (!products || products.length === 0) {
      try {
        products = await withTimeout(
          getProductsService({
            search: query,
            limit,
            minPrice,
            maxPrice,
            category,
          }),
          3000
        );
        if (products.length > 0) {
          console.log(`[Search] Keyword fallback returned ${products.length} products for "${query}"`);
        } else {
          console.log(`[Search] Genuine zero matches for "${query}" across catalog`);
        }
      } catch (fallbackError) {
        console.error(`[Search] Keyword fallback error for "${query}": ${fallbackError.message}`);
        if (semanticErrorOccurred) {
          return res.status(500).json({
            success: false,
            message: "Search service is temporarily unavailable. Please try again later.",
          });
        }
        products = [];
      }
    }

    if (req.query.format === "array") {
      return res.status(200).json(products);
    }

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
      data: products,
    });
  } catch (error) {
    console.error("Product search controller error:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while searching for products",
    });
  }
}
