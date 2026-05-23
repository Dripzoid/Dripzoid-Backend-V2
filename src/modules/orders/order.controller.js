import {
  createOrderService,
  attachShipmentToOrderService,
} from "./order.service.js";

import {
  normalizeShippingAddress,
  normalizeOrderItems,
  buildShiprocketPayload,
} from "./order.utils.js";

import {
  createShiprocketOrder,
  checkServiceability,
} from "../../integrations/shiprocket/shiprocket.service.js";

import {
  logUserActivity,
} from "../../utils/activityLogger.js";

import {
  AppError,
} from "../../errors/AppError.js";

/* =====================================================
   🚀 PLACE ORDER
===================================================== */

export const placeOrder =
  async (req, res, next) => {

    try {

      const {
        items = [],
        shippingAddress,
        paymentMethod,
        paymentDetails,
        totalAmount,
      } = req.body;

      const userId =
        req.user?.id;

      /* =========================================
         🔐 AUTH VALIDATION
      ========================================= */

      if (!userId) {
        throw new AppError(
          "Unauthorized",
          401
        );
      }

      /* =========================================
         📦 ORDER VALIDATION
      ========================================= */

      if (
        !Array.isArray(items) ||
        !items.length
      ) {
        throw new AppError(
          "No items provided",
          400
        );
      }

      /* =========================================
         📦 NORMALIZE INPUTS
      ========================================= */

      const normalizedAddress =
        normalizeShippingAddress(
          shippingAddress,
          req.user
        );

      const normalizedItems =
        normalizeOrderItems(
          items
        );

      /* =========================================
         🚚 CHECK DELIVERY SERVICEABILITY
      ========================================= */

      let deliveryDate =
        null;

      try {

        const serviceability =
          await checkServiceability(
            normalizedAddress.pincode,
            {
              weight: 1,
            }
          );

        if (
          serviceability?.length
        ) {
          deliveryDate =
            serviceability[0]
              ?.etd || null;
        }

      } catch (svcErr) {

        console.warn(
          "⚠️ Serviceability check failed:",
          svcErr.message
        );

        // NON-BLOCKING
      }

      /* =========================================
   💾 CREATE LOCAL ORDER
========================================= */

const orderData =
  await createOrderService({
    userId,

    items:
      normalizedItems,

    shippingAddress:
      normalizedAddress,

    paymentMethod,

    paymentDetails,

    totalAmount,

    deliveryDate,
  });

const {
  orderId,
  orderNumber,
} = orderData;

      /* =========================================
         🚀 CREATE SHIPROCKET ORDER
      ========================================= */

      let shiprocket =
        null;

      try {

        const payload =
          buildShiprocketPayload({
            orderId,

            items:
              normalizedItems,

            shippingAddress:
              normalizedAddress,

            paymentMethod,

            totalAmount,
          });

        shiprocket =
          await createShiprocketOrder(
            payload
          );

        /* =====================================
           🔗 ATTACH SHIPMENT DETAILS
        ===================================== */

        if (
          shiprocket?.order_id ||
          shiprocket?.shipment_id
        ) {

          await attachShipmentToOrderService({
            orderId,

            shiprocketOrderId:
              shiprocket?.order_id ||
              null,

            shipmentId:
              shiprocket?.shipment_id ||
              null,

            awbCode:
              shiprocket?.awb_code ||
              null,
          });
        }

      } catch (shipErr) {

        console.error(
          "❌ Shiprocket Integration Failed:",
          {
            message:
              shipErr.message,

            details:
              shipErr.details ||
              shipErr?.response
                ?.data,
          }
        );

        // 🚨 IMPORTANT:
        // DO NOT FAIL ORDER
        // Local order already exists
      }

      /* =========================================
         📝 USER ACTIVITY LOG
      ========================================= */

      try {

        await logUserActivity({
          userId,

          action:
            `Placed order #${orderId}`,
        });

      } catch (logErr) {

        console.error(
          "⚠️ Activity log failed:",
          logErr.message
        );

        // NON-BLOCKING
      }

      /* =========================================
         ✅ SUCCESS RESPONSE
      ========================================= */

      return res.status(201).json({
        success: true,

        message:
          "Order placed successfully",

        data: {
          orderId,

          deliveryDate,

          shiprocketOrderId:
            shiprocket
              ?.order_id ||
            null,

          shipmentId:
            shiprocket
              ?.shipment_id ||
            null,
        },
      });

    } catch (error) {

      return next(error);
    }
  };