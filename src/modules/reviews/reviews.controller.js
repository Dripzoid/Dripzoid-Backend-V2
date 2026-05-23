import {
  getProductReviewsService,
  getReviewByIdService,
  createReviewService,
  deleteReviewService,
} from "./reviews.service.js";

// 📦 GET PRODUCT REVIEWS
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
        error:
          err.message ||
          "Failed to fetch reviews",
      });
    }
  };

// 📦 GET SINGLE REVIEW
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
        error:
          err.message ||
          "Review not found",
      });
    }
  };

// ➕ CREATE REVIEW
export const createReview =
  async (req, res) => {
    try {
      const {
        productId,
        userId,
        rating,
        text,
        imageUrl,
      } = req.body;

      // validation
      if (
        !productId ||
        !userId ||
        !rating
      ) {
        return res.status(400).json({
          error:
            "productId, userId and rating are required",
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

      res.status(201).json(data);
    } catch (err) {
      console.error(
        "createReview error:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to create review",
      });
    }
  };

// ❌ DELETE REVIEW
export const deleteReview =
  async (req, res) => {
    try {
      await deleteReviewService(
        req.params.id
      );

      res.json({
        success: true,
        message:
          "Review deleted",
      });
    } catch (err) {
      console.error(
        "deleteReview error:",
        err
      );

      res.status(404).json({
        error:
          err.message ||
          "Review not found",
      });
    }
  };