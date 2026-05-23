import express from "express";

import {
  getProductReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
} from "./reviews.controller.js";

import {
  authenticateToken,
} from "../../middlewares/auth.middleware.js";

const router = express.Router();

/* =========================================
   📦 GET PRODUCT REVIEWS
========================================= */

router.get(
  "/product/:productId",
  getProductReviews
);

/* =========================================
   📦 GET SINGLE REVIEW
========================================= */

router.get(
  "/:id",
  getReviewById
);

/* =========================================
   ➕ CREATE REVIEW
========================================= */

router.post(
  "/",
  authenticateToken,
  createReview
);

/* =========================================
   ✏️ UPDATE REVIEW
========================================= */

router.put(
  "/:id",
  authenticateToken,
  updateReview
);

/* =========================================
   ❌ DELETE REVIEW
========================================= */

router.delete(
  "/:id",
  authenticateToken,
  deleteReview
);

export default router;
