import {
  getProductsService,
  getFeaturedProductsService,
  getTrendingProductsService,
  getProductByIdService,
} from "./product.service.js";

/* =====================================================
   🔥 GET PRODUCTS
===================================================== */

export const getProducts =
  async (req, res) => {
    try {
      const products =
        await getProductsService(
          req.query
        );

      return res.status(200).json({
        success: true,

        count:
          products.length,

        products,
      });
    } catch (error) {
      console.error(
        "❌ Get Products Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to fetch products",
      });
    }
  };

/* =====================================================
   🔥 GET PRODUCT BY ID
===================================================== */

export const getProductById =
  async (req, res) => {
    try {
      const product =
        await getProductByIdService(
          req.params.id
        );

      if (!product) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Product not found",
          });
      }

      return res.status(200).json({
        success: true,

        product,
      });
    } catch (error) {
      console.error(
        "❌ Get Product By ID Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to fetch product",
      });
    }
  };

/* =====================================================
   🔥 FEATURED PRODUCTS
===================================================== */

export const getFeaturedProducts =
  async (req, res) => {
    try {
      const products =
        await getFeaturedProductsService();

      return res.status(200).json({
        success: true,

        count:
          products.length,

        products,
      });
    } catch (error) {
      console.error(
        "❌ Featured Products Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to fetch featured products",
      });
    }
  };

/* =====================================================
   🔥 TRENDING PRODUCTS
===================================================== */

export const getTrendingProducts =
  async (req, res) => {
    try {
      const products =
        await getTrendingProductsService();

      return res.status(200).json({
        success: true,

        count:
          products.length,

        products,
      });
    } catch (error) {
      console.error(
        "❌ Trending Products Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to fetch trending products",
      });
    }
  };
