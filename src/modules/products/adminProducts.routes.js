import express from "express";

import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./adminProducts.controller.js";

import { adminAuth }
from "../../middlewares/admin.middleware.js";

const router = express.Router();

// 📦 GET ALL PRODUCTS
router.get(
  "/",
  adminAuth,
  getProducts
);

// 📦 GET SINGLE PRODUCT
router.get(
  "/:id",
  adminAuth,
  getProduct
);

// ➕ CREATE PRODUCT
router.post(
  "/",
  adminAuth,
  createProduct
);

// ✏️ UPDATE PRODUCT
router.put(
  "/:id",
  adminAuth,
  updateProduct
);

// ❌ DELETE PRODUCT
router.delete(
  "/:id",
  adminAuth,
  deleteProduct
);

export default router;