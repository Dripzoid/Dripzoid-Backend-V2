import express from "express";

import {
  getProducts,
  getProductById,
  getFeaturedProducts,
  getTrendingProducts,
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