// modules/admin/orders/adminOrders.routes.js

import express from "express";

import {
  getAllOrders,
  getOrder,
  updateStatus,
  deleteOrder,
  bulkUpdateOrders,
} from "./adminOrders.controller.js";

import {
  adminAuth,
} from "../../middlewares/admin.middleware.js";

const router =
  express.Router();

/* =====================================================
   📦 GET ORDERS
===================================================== */

router.get(
  "/",
  adminAuth,
  getAllOrders
);

router.get(
  "/:id",
  adminAuth,
  getOrder
);

/* =====================================================
   🔄 UPDATE STATUS
===================================================== */

router.patch(
  "/:id",
  adminAuth,
  updateStatus
);

router.put(
  "/:id",
  adminAuth,
  updateStatus
);

router.put(
  "/:id/status",
  adminAuth,
  updateStatus
);

/* =====================================================
   📦 BULK UPDATE
===================================================== */

router.post(
  "/bulk-update",
  adminAuth,
  bulkUpdateOrders
);

router.put(
  "/bulk-update",
  adminAuth,
  bulkUpdateOrders
);

/* =====================================================
   ❌ DELETE
===================================================== */

router.delete(
  "/:id",
  adminAuth,
  deleteOrder
);

export default router;
