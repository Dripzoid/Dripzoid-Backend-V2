import {
  getProductReviewsService,
  getReviewByIdService,
  createReviewService,
  updateReviewService,
  deleteReviewService,
} from "./reviews.service.js";

/* =========================================
   📦 GET PRODUCT REVIEWS
========================================= */

export const getProductReviews =
  async (req, res) => {
    try {
      const data =
        await getProductReviewsService(
          req.params.productId
        );

      res.json(data);

    } catch (err) {
      console.error(
        "getProductReviews error:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to fetch reviews",
      });
    }
  };

/* =========================================
   📦 GET SINGLE REVIEW
========================================= */

export const getReviewById =
  async (req, res) => {
    try {
      const data =
        await getReviewByIdService(
          req.params.id
        );

      res.json(data);

    } catch (err) {
      console.error(
        "getReviewById error:",
        err
      );

      res.status(404).json({
        success: false,
        error:
          err.message ||
          "Review not found",
      });
    }
  };

/* =========================================
   ➕ CREATE REVIEW
========================================= */

export const createReview =
  async (req, res) => {
    try {
      const {
        productId,
        rating,
        text,
        imageUrl,
      } = req.body;

      // authenticated user
      const userId =
        req.user?.id;

      /* =========================
         VALIDATION
      ========================= */

      if (
        !productId ||
        !rating
      ) {
        return res.status(400).json({
          success: false,
          error:
            "productId and rating are required",
        });
      }

      // rating validation
      if (
        rating < 1 ||
        rating > 5
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Rating must be between 1 and 5",
        });
      }

      const data =
        await createReviewService({
          productId,
          userId,
          rating,
          text,
          imageUrl,
        });

      res.status(201).json({
        success: true,
        data,
      });

    } catch (err) {
      console.error(
        "createReview error:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to create review",
      });
    }
  };

/* =========================================
   ✏️ UPDATE REVIEW
========================================= */

export const updateReview =
  async (req, res) => {
    try {
      const reviewId =
        req.params.id;

      const {
        rating,
        text,
        imageUrl,
      } = req.body;

      const userId =
        req.user?.id;

      /* =========================
         VALIDATION
      ========================= */

      if (
        rating &&
        (rating < 1 || rating > 5)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Rating must be between 1 and 5",
        });
      }

      const data =
        await updateReviewService({
          reviewId,
          userId,
          rating,
          text,
          imageUrl,
        });

      res.json({
        success: true,
        data,
      });

    } catch (err) {
      console.error(
        "updateReview error:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to update review",
      });
    }
  };

/* =========================================
   ❌ DELETE REVIEW
========================================= */

export const deleteReview =
  async (req, res) => {
    try {
      const reviewId =
        req.params.id;

      const userId =
        req.user?.id;

      await deleteReviewService({
        reviewId,
        userId,
      });

      res.json({
        success: true,
        message:
          "Review deleted successfully",
      });

    } catch (err) {
      console.error(
        "deleteReview error:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to delete review",
      });
    }
  };
