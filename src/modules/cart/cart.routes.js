import express from "express";

import {
  getUserCart,
  getCartByUserId,
  addToCart,
  updateCartItem,
  deleteCartItem,
  clearCart,
} from "./cart.controller.js";

import { authenticateToken }
from "../../middlewares/auth.middleware.js";

const router = express.Router();

/* =========================================
   🔐 ALL CART ROUTES REQUIRE AUTH
========================================= */

router.use(authenticateToken);

/* =========================================
   📦 GET LOGGED-IN USER CART
========================================= */

router.get(
  "/",
  getUserCart
);

/* =========================================
   📦 GET CART BY USER ID
========================================= */

router.get(
  "/:id",
  getCartByUserId
);

/* =========================================
   ➕ ADD TO CART
========================================= */

router.post(
  "/",
  addToCart
);

/* =========================================
   ✏️ UPDATE CART ITEM
========================================= */

router.put(
  "/:id",
  updateCartItem
);

/* =========================================
   ❌ DELETE CART ITEM
========================================= */

router.delete(
  "/:id",
  deleteCartItem
);

/* =========================================
   ❌ CLEAR CART
========================================= */

router.delete(
  "/",
  clearCart
);

export default router;