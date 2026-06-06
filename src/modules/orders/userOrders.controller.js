import {
  getUserOrdersService,
  getOrderByIdService,
  cancelOrderService,
  reorderService,
  verifyProductPurchaseService,
  trackOrderService,
  downloadInvoiceService,
} from "./userOrders.service.js";

/* =====================================================
   📦 GET ALL USER ORDERS
===================================================== */

export const getUserOrders =
  async (req, res) => {
    try {
      const userId =
        req.user.id;

      const page =
        Number(
          req.query.page
        ) || 1;

      const limit =
        Number(
          req.query.limit
        ) || 10;

      const data =
        await getUserOrdersService(
          userId,
          req.query
        );

      return res.json({
        success: true,

        data,

        meta: {
          total:
            data.length,

          page,

          pages: 1,

          limit,
        },
      });
    } catch (err) {
      console.error(
        "getUserOrders error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Failed to fetch orders",
      });
    }
  };

/* =====================================================
   📦 GET SINGLE ORDER
===================================================== */

export const getOrder =
  async (req, res) => {
    try {
      const data =
        await getOrderByIdService(
          req.user.id,
          req.params.id
        );

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      console.error(
        "getOrder error:",
        err
      );

      return res.status(404).json({
        success: false,
        message:
          err.message ||
          "Order not found",
      });
    }
  };

/* =====================================================
   ❌ CANCEL ORDER
===================================================== */

export const cancelOrder =
  async (req, res) => {
    try {
      await cancelOrderService(
        req.user.id,
        req.params.id
      );

      return res.json({
        success: true,
        message:
          "Order cancelled successfully",
      });
    } catch (err) {
      console.error(
        "cancelOrder error:",
        err
      );

      return res.status(400).json({
        success: false,
        message:
          err.message ||
          "Failed to cancel order",
      });
    }
  };

/* =====================================================
   🔁 REORDER
===================================================== */

export const reorder =
  async (req, res) => {
    try {
      const newOrderId =
        await reorderService(
          req.user.id,
          req.params.id
        );

      const orders =
        await getUserOrdersService(
          req.user.id,
          {}
        );

      return res.json({
        success: true,

        message:
          "Reorder placed successfully",

        newOrderId,

        orders,
      });
    } catch (err) {
      console.error(
        "reorder error:",
        err
      );

      return res.status(400).json({
        success: false,
        message:
          err.message ||
          "Reorder failed",
      });
    }
  };

/* =====================================================
   ✅ VERIFY PRODUCT PURCHASE
===================================================== */

export const verifyProductPurchase =
  async (req, res) => {
    try {
      const userId =
        req.query.userId ||
        req.body.userId ||
        req.user?.id;

      const productId =
        req.query.productId ||
        req.body.productId;

      if (
        !userId ||
        !productId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "userId and productId are required",
        });
      }

      const purchased =
        await verifyProductPurchaseService(
          userId,
          productId
        );

      return res.json({
        success: true,

        purchased,

        canReview:
          purchased,
      });
    } catch (err) {
      console.error(
        "verifyProductPurchase error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Verification failed",
      });
    }
  };
/* =====================================================
   📍 TRACK ORDER
===================================================== */

export const trackOrder =
  async (req, res) => {
    try {
      const tracking =
        await trackOrderService(
          req.user.id,
          req.params.id
        );

      return res.json({
        success: true,
        tracking,
      });
    } catch (err) {
      console.error(
        "trackOrder error:",
        err
      );

      return res.status(400).json({
        success: false,
        message:
          err.message ||
          "Tracking failed",
      });
    }
  };

/* =====================================================
   🧾 DOWNLOAD INVOICE
===================================================== */

export const downloadInvoice =
  async (req, res) => {
    try {
      const invoice =
        await downloadInvoiceService(
          req.user.id,
          req.params.id
        );

      return res.json({
        success: true,
        invoice,
      });
    } catch (err) {
      console.error(
        "downloadInvoice error:",
        err
      );

      return res.status(400).json({
        success: false,
        message:
          err.message ||
          "Invoice unavailable",
      });
    }
  };
