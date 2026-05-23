import {
  getProductsService,
  getFeaturedProductsService,
  getTrendingProductsService,
  getProductByIdService,
} from "./product.service.js";

/* =====================================================
   🔥 GET PRODUCTS
===================================================== */

export const getProducts = async (
  req,
  res
) => {
  try {
    const data =
      await getProductsService(
        req.query
      );

    res.json(data);
  } catch (err) {
    res.status(500).json({
      success: false,

      message:
        err.message,
    });
  }
};

/* =====================================================
   🔥 GET PRODUCT BY ID
===================================================== */

export const getProductById =
  async (req, res) => {
    try {
      const data =
        await getProductByIdService(
          req.params.id
        );

      if (!data) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Product not found",
          });
      }

      res.json(data);
    } catch (err) {
      res.status(500).json({
        success: false,

        message:
          err.message,
      });
    }
  };

/* =====================================================
   🔥 FEATURED PRODUCTS
===================================================== */

export const getFeaturedProducts =
  async (req, res) => {
    try {
      const data =
        await getFeaturedProductsService();

      res.json(data);
    } catch (err) {
      res.status(500).json({
        success: false,

        message:
          err.message,
      });
    }
  };

/* =====================================================
   🔥 TRENDING PRODUCTS
===================================================== */

export const getTrendingProducts =
  async (req, res) => {
    try {
      const data =
        await getTrendingProductsService();

      res.json(data);
    } catch (err) {
      res.status(500).json({
        success: false,

        message:
          err.message,
      });
    }
  };