import express from "express";

import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  bulkCouponAction,
  redeemCoupon,
  getCouponAnalytics,
  getCouponAuditLogs,
} from "./coupons.controller.js";

import {
  authenticateToken,
} from "../../middlewares/auth.middleware.js";

import {
  adminAuth,
} from "../../middlewares/admin.middleware.js";

const router = express.Router();

/* =====================================================
   ❤️ HEALTH
===================================================== */

router.get(
  "/health",
  (_, res) => {
    res.json({
      ok: true,
    });
  }
);

/* =====================================================
   🌍 PUBLIC ROUTES
===================================================== */

// 🎟️ Redeem coupon
router.post(
  "/redeem",
  authenticateToken,
  redeemCoupon
);

/* =====================================================
   🔐 ADMIN ROUTES
===================================================== */

// 📦 Get all coupons
router.get(
  "/",
  authenticateToken,
  adminAuth,
  getCoupons
);

// ➕ Create coupon
router.post(
  "/",
  authenticateToken,
  adminAuth,
  createCoupon
);

// ✏️ Update coupon
router.put(
  "/:id",
  authenticateToken,
  adminAuth,
  updateCoupon
);

// ❌ Delete coupon
router.delete(
  "/:id",
  authenticateToken,
  adminAuth,
  deleteCoupon
);

// 🔥 Bulk actions
router.post(
  "/bulk",
  authenticateToken,
  adminAuth,
  bulkCouponAction
);

// 📊 Analytics
router.get(
  "/analytics",
  authenticateToken,
  adminAuth,
  getCouponAnalytics
);

// 📜 Audit logs
router.get(
  "/audit",
  authenticateToken,
  adminAuth,
  getCouponAuditLogs
);

export default router;