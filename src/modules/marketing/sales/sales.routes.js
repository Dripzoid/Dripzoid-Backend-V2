import express from "express";

import {
  getPublicSales,
  getPublicSaleDetails,

  getAdminSales,
  createSale,
  updateSale,
  deleteSale,

  addProductsToSale,
  removeProductFromSale,

  getAdminSaleDetails,
} from "./sales.controller.js";

import { adminAuth }
from "../../../middlewares/admin.middleware.js";

const router = express.Router();

/* ======================================================
   🌍 PUBLIC ROUTES
====================================================== */

// 🔥 Public sales
router.get(
  "/public/sales",
  getPublicSales
);

// 🔥 Public sale details
router.get(
  "/public/sales/:id/details",
  getPublicSaleDetails
);

/* ======================================================
   🔐 ADMIN ROUTES
====================================================== */

// 📦 All sales
router.get(
  "/admin/sales",
  adminAuth,
  getAdminSales
);

// ➕ Create sale
router.post(
  "/admin/sales",
  adminAuth,
  createSale
);

// ✏️ Update sale
router.put(
  "/admin/sales/:id",
  adminAuth,
  updateSale
);

// ❌ Delete sale
router.delete(
  "/admin/sales/:id",
  adminAuth,
  deleteSale
);

// ➕ Add products
router.post(
  "/admin/sales/:sale_id/products",
  adminAuth,
  addProductsToSale
);

// ❌ Remove product
router.delete(
  "/admin/sales/:sale_id/products/:product_id",
  adminAuth,
  removeProductFromSale
);

// 📦 Admin sale details
router.get(
  "/admin/sales/:id/details",
  adminAuth,
  getAdminSaleDetails
);

export default router;