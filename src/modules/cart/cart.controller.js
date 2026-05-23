import {
  getUserCartService,
  getCartByUserIdService,
  addToCartService,
  updateCartItemService,
  deleteCartItemService,
  clearCartService,
} from "./cart.service.js";

// 📦 GET LOGGED-IN USER CART
export const getUserCart =
  async (req, res) => {
    try {
      const data =
        await getUserCartService(
          req.user.id
        );

      res.json(data);
    } catch (err) {
      console.error(
        "getUserCart error:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to fetch cart",
      });
    }
  };

// 📦 GET CART BY USER ID
export const getCartByUserId =
  async (req, res) => {
    try {
      const requestedUserId =
        Number(req.params.id);

      if (!requestedUserId) {
        return res.status(400).json({
          message:
            "Invalid user ID",
        });
      }

      const cartItems =
        await getCartByUserIdService(
          requestedUserId,
          req.user.id
        );

      res.json({
        cartItems:
          cartItems || [],
      });
    } catch (err) {
      console.error(
        "getCartByUserId error:",
        err
      );

      if (
        err.message ===
        "Forbidden"
      ) {
        return res.status(403).json({
          message:
            "Forbidden: Cannot access another user's cart",
        });
      }

      res.status(500).json({
        message:
          err.message ||
          "Failed to fetch cart items",
      });
    }
  };

// ➕ ADD TO CART
export const addToCart =
  async (req, res) => {
    try {
      const {
        product_id,
        quantity,
        selectedSize,
        selectedColor,
      } = req.body;

      const data =
        await addToCartService({
          userId: req.user.id,

          product_id,

          quantity,

          selectedSize,

          selectedColor,
        });

      res.json(data);
    } catch (err) {
      console.error(
        "addToCart error:",
        err
      );

      res.status(400).json({
        error:
          err.message ||
          "Failed to add to cart",
      });
    }
  };

// ✏️ UPDATE CART ITEM
export const updateCartItem =
  async (req, res) => {
    try {
      const { quantity } =
        req.body;

      const data =
        await updateCartItemService({
          cartId:
            req.params.id,

          userId:
            req.user.id,

          quantity,
        });

      res.json(data);
    } catch (err) {
      console.error(
        "updateCartItem error:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to update cart",
      });
    }
  };

// ❌ DELETE CART ITEM
export const deleteCartItem =
  async (req, res) => {
    try {
      const data =
        await deleteCartItemService({
          cartId:
            req.params.id,

          userId:
            req.user.id,
        });

      res.json(data);
    } catch (err) {
      console.error(
        "deleteCartItem error:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to delete cart item",
      });
    }
  };

// ❌ CLEAR CART
export const clearCart =
  async (req, res) => {
    try {
      const data =
        await clearCartService(
          req.user.id
        );

      res.json(data);
    } catch (err) {
      console.error(
        "clearCart error:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to clear cart",
      });
    }
  };