import {
  searchProductsSemantic,
} from "./semantic.service.js";

export async function searchProducts(
  req,
  res
) {
  try {

    const {
      query,
      limit = 10,
    } = req.body;

    const products =
      await searchProductsSemantic(
        query,
        limit
      );

    return res.status(200).json({
      success: true,
      count:
        products.length,
      products,
    });

  } catch (error) {

    console.error(
      "Semantic Search Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message,
    });

  }
}
