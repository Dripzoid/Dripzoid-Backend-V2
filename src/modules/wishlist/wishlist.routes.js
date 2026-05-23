import express from "express";

import {
  getWishlist,
  addWishlistItem,
  bulkAddWishlist,
  removeWishlistItem,
  bulkRemoveWishlist,
  moveWishlistToCart,
} from "./wishlist.controller.js";

import {
  authenticateToken,
} from "../../middlewares/auth.middleware.js";

const router = express.Router();

/* =====================================================
   🔐 ALL WISHLIST ROUTES REQUIRE AUTH
===================================================== */

router.use(authenticateToken);

/* =====================================================
   📦 GET USER WISHLIST
===================================================== */

router.get(
  "/",
  getWishlist
);

/* =====================================================
   🔄 MOVE TO CART
===================================================== */

router.post(
  "/move-to-cart",
  moveWishlistToCart
);

/* =====================================================
   ➕ BULK ADD
===================================================== */

router.post(
  "/bulk",
  bulkAddWishlist
);

/* =====================================================
   ➕ ADD SINGLE
===================================================== */

router.post(
  "/:productId",
  addWishlistItem
);

/* =====================================================
   ❌ BULK REMOVE
===================================================== */

router.delete(
  "/bulk",
  bulkRemoveWishlist
);

/* =====================================================
   ❌ REMOVE SINGLE
===================================================== */

router.delete(
  "/:productId",
  removeWishlistItem
);

export default router;