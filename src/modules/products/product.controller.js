import {
  getProductsService,
  getFeaturedProductsService,
  getTrendingProductsService,
  getProductByIdService,
  getCategoriesService,
  getRelatedProductsService,
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
          error.message,
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

      /* =========================
         OLD RESPONSE FORMAT
      ========================= */

      return res.json(product);
    } catch (error) {
      console.error(
        "❌ Product Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message,
      });
    }
  };

/* =====================================================
   🔥 GET CATEGORIES
===================================================== */

export const getCategories =
  async (req, res) => {
    try {
      const categories =
        await getCategoriesService(
          req.query
        );

      return res.status(200).json({
        success: true,

        categories,
      });
    } catch (error) {
      console.error(
        "❌ Categories Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message,
      });
    }
  };

/* =====================================================
   🔥 RELATED PRODUCTS
===================================================== */

export const getRelatedProducts =
  async (req, res) => {
    try {
      const products =
        await getRelatedProductsService(
          req.params.id
        );

      return res.status(200).json({
        success: true,

        count:
          products.length,

        products,
      });
    } catch (error) {
      console.error(
        "❌ Related Products Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message,
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
      return res.status(500).json({
        success: false,

        message:
          error.message,
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
      return res.status(500).json({
        success: false,

        message:
          error.message,
      });
    }
  };
