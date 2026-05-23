import express from "express";

import {
  getProductReviews,
  getReviewById,
  createReview,
  deleteReview,
} from "./reviews.controller.js";

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
  createReview
);

/* =========================================
   ❌ DELETE REVIEW
========================================= */

router.delete(
  "/:id",
  deleteReview
);

export default router;