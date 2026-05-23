import express from "express";

import {
  getUserOrders,
  getOrder,
  cancelOrder,
  reorder,
  verifyProductPurchase,
} from "./userOrders.controller.js";

import {
  authenticateToken,
} from "../../middlewares/auth.middleware.js";

const router =
  express.Router();

/* =====================================================
   📦 GET ALL USER ORDERS
===================================================== */

router.get(
  "/",
  authenticateToken,
  getUserOrders
);

/* =====================================================
   📦 GET SINGLE ORDER
===================================================== */

router.get(
  "/:id",
  authenticateToken,
  getOrder
);

/* =====================================================
   ❌ CANCEL ORDER
===================================================== */

router.put(
  "/:id/cancel",
  authenticateToken,
  cancelOrder
);

/* =====================================================
   🔁 REORDER
===================================================== */

router.post(
  "/:id/reorder",
  authenticateToken,
  reorder
);

/* =====================================================
   ✅ VERIFY PRODUCT PURCHASE
===================================================== */

router.get(
  "/verify",
  authenticateToken,
  verifyProductPurchase
);

router.post(
  "/verify",
  authenticateToken,
  verifyProductPurchase
);

export default router;