import express from "express";

import {
  getProducts,
  getProductById,
  getFeaturedProducts,
  getTrendingProducts,
  getCategories,
  getRelatedProducts,
} from "./product.controller.js";

const router =
  express.Router();

/* =====================================================
   🔥 ALL PRODUCTS
===================================================== */

router.get(
  "/products",
  getProducts
);

/* =====================================================
   🔥 PRODUCT CATEGORIES
===================================================== */

router.get(
  "/products/categories",
  getCategories
);

/* =====================================================
   🔥 RELATED PRODUCTS
===================================================== */

router.get(
  "/products/:id/related",
  getRelatedProducts
);

/* =====================================================
   🔥 PRODUCT BY ID
===================================================== */

router.get(
  "/products/:id",
  getProductById
);

/* =====================================================
   🔥 FEATURED PRODUCTS
===================================================== */

router.get(
  "/featured",
  getFeaturedProducts
);

/* =====================================================
   🔥 TRENDING PRODUCTS
===================================================== */

router.get(
  "/trending",
  getTrendingProducts
);

export default router;
