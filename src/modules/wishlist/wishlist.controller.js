import {
  getWishlistService,
  addWishlistItemService,
  bulkAddWishlistService,
  removeWishlistItemService,
  bulkRemoveWishlistService,
  moveWishlistToCartService,
} from "./wishlist.service.js";

/* =====================================================
   📦 GET WISHLIST
===================================================== */

export const getWishlist =
  async (req, res) => {
    try {
      const data =
        await getWishlistService(
          req.user.id
        );

      res.json(data);
    } catch (err) {
      console.error(
        "getWishlist error:",
        err
      );

      res.status(500).json({
        error:
          "failed_to_fetch_wishlist",
      });
    }
  };

/* =====================================================
   ➕ ADD SINGLE
===================================================== */

export const addWishlistItem =
  async (req, res) => {
    try {
      const result =
        await addWishlistItemService({
          userId:
            req.user.id,

          productId:
            req.params.productId,
        });

      res.json({
        message:
          "Added to wishlist",

        id: result.id,
      });
    } catch (err) {
      console.error(
        "addWishlistItem error:",
        err
      );

      if (
        err.message ===
        "product_not_found"
      ) {
        return res.status(404).json({
          error:
            "product_not_found",
        });
      }

      res.status(500).json({
        error:
          "failed_to_add_wishlist",
      });
    }
  };

/* =====================================================
   ➕ BULK ADD
===================================================== */

export const bulkAddWishlist =
  async (req, res) => {
    try {
      await bulkAddWishlistService({
        userId:
          req.user.id,

        productIds:
          req.body.productIds,
      });

      res.json({
        message:
          "Bulk add successful",
      });
    } catch (err) {
      console.error(
        "bulkAddWishlist error:",
        err
      );

      if (
        err.message ===
        "invalid_product_ids"
      ) {
        return res.status(400).json({
          error:
            "invalid_product_ids",
        });
      }

      res.status(500).json({
        error:
          "bulk_add_failed",
      });
    }
  };

/* =====================================================
   ❌ REMOVE SINGLE
===================================================== */

export const removeWishlistItem =
  async (req, res) => {
    try {
      const result =
        await removeWishlistItemService({
          userId:
            req.user.id,

          productId:
            req.params.productId,
        });

      res.json({
        message: "Removed",
        changes:
          result.deleted,
      });
    } catch (err) {
      console.error(
        "removeWishlistItem error:",
        err
      );

      res.status(500).json({
        error:
          "failed_to_remove_wishlist",
      });
    }
  };

/* =====================================================
   ❌ BULK REMOVE
===================================================== */

export const bulkRemoveWishlist =
  async (req, res) => {
    try {
      const result =
        await bulkRemoveWishlistService({
          userId:
            req.user.id,

          productIds:
            req.body.productIds,
      });

      res.json({
        message:
          "Bulk delete successful",

        changes:
          result.deleted,
      });
    } catch (err) {
      console.error(
        "bulkRemoveWishlist error:",
        err
      );

      if (
        err.message ===
        "invalid_product_ids"
      ) {
        return res.status(400).json({
          error:
            "invalid_product_ids",
        });
      }

      res.status(500).json({
        error:
          "bulk_delete_failed",
      });
    }
  };

/* =====================================================
   🔄 MOVE TO CART
===================================================== */

export const moveWishlistToCart =
  async (req, res) => {
    try {
      await moveWishlistToCartService({
        userId:
          req.user.id,

        productIds:
          req.body.productIds,
      });

      res.json({
        message:
          "Moved to cart successfully",
      });
    } catch (err) {
      console.error(
        "moveWishlistToCart error:",
        err
      );

      if (
        err.message ===
        "invalid_product_ids"
      ) {
        return res.status(400).json({
          error:
            "invalid_product_ids",
        });
      }

      res.status(500).json({
        error:
          "move_to_cart_failed",
      });
    }
  };