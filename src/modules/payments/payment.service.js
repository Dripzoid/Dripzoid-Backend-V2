// src/modules/payments/payment.service.js

import prisma from "../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";

import {
  createRazorpayOrder,
  verifyPaymentSignature,
  fetchPayment,
  buildRazorpayReceipt,
} from "../../integrations/razorpay/razorpay.service.js";

import { createShiprocketOrder } from "../../integrations/shiprocket/shiprocket.service.js";

import {
  reserveProductStock,
  reserveProductSizeStock,
} from "../orders/order.service.js";

import {
  createPaymentOrder,
  insertOrderItem,
  getOrderById,
  getOrderByPaymentId,
  getOrderItems,
  updateRazorpayOrder,
  confirmPayment,
} from "./payment.repository.js";

/* =====================================================
   HELPERS
===================================================== */

function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      product_id:
        item?.product_id ??
        item?.productId ??
        item?.id ??
        null,

      quantity: Number(
        item?.quantity ??
          item?.qty ??
          1
      ),

      unit_price: Number(
        item?.unit_price ??
          item?.unitPrice ??
          item?.price ??
          0
      ),

      selectedColor:
        item?.selectedColor ??
        item?.color ??
        null,

      selectedSize:
        item?.selectedSize ??
        item?.size ??
        null,

      variantId:
        item?.variantId ??
        item?.variant_id ??
        null,

      name:
        item?.name ??
        item?.product_name ??
        item?.title ??
        null,

      sku: item?.sku ?? null,
    }))
    .filter(
      (item) =>
        item.product_id &&
        item.quantity > 0
    );
}

function normalizeShipping(shipping) {
  const s =
    shipping && typeof shipping === "object"
      ? shipping
      : {};

  const line1 =
    s.line1 ??
    s.address ??
    s.addressLine1 ??
    s.address_line1 ??
    s.address1 ??
    "";

  const line2 =
    s.line2 ??
    s.addressLine2 ??
    s.address_line2 ??
    s.address2 ??
    "";

  const city =
    s.city ??
    s.town ??
    "";

  const state =
    s.state ??
    "";

  const pincode =
    s.pincode ??
    s.postcode ??
    s.zip ??
    "";

  const country =
    s.country ??
    "India";

  return {
    ...s,

    name:
      s.name ??
      s.customerName ??
      "",

    customerName:
      s.customerName ??
      s.name ??
      "",

    phone:
      s.phone ??
      "",

    email:
      s.email ??
      "",

    line1,
    line2,
    city,
    state,
    pincode,
    country,

    address:
      s.address ??
      [
        line1,
        line2,
        city,
        state,
        pincode,
        country,
      ]
        .filter(Boolean)
        .join(", "),
  };
}

/* =====================================================
   💳 CREATE RAZORPAY ORDER
===================================================== */

export async function createRazorpayOrderService({
  userId,
  items,
  shipping,
  totalAmount,
}) {
  if (!userId) {
    throw new AppError(
      "Unauthorized",
      401
    );
  }

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new AppError(
      "No items provided",
      400
    );
  }

  const normalizedItems =
    normalizeItems(items);

  if (
    normalizedItems.length === 0
  ) {
    throw new AppError(
      "No valid items provided",
      400
    );
  }

  const normalizedShipping =
    normalizeShipping(shipping);

  /*
   * Razorpay expects amount in paise.
   * Example:
   * ₹599 -> 59900 paise
   */
  const amount = Math.round(
    Number(totalAmount) * 100
  );

  if (!amount || amount <= 0) {
    throw new AppError(
      "Invalid amount",
      400
    );
  }

  /*
   * IMPORTANT:
   *
   * createPaymentOrder() is responsible for:
   *
   * 1. Creating a temporary order number
   * 2. Creating the DB order
   * 3. Generating the final DRIP-YYYYMMDD-ID order number
   * 4. Returning the internal order ID
   */
  const internalOrderId =
    await createPaymentOrder({
      userId,

      shippingJson:
        JSON.stringify(
          normalizedShipping
        ),

      totalAmount:
        Number(totalAmount) || 0,

      status: "Pending",
    });

  /*
   * Insert every product into OrderItem.
   */
  for (const item of normalizedItems) {
    await insertOrderItem({
      orderId:
        internalOrderId,

      productId:
        item.product_id,

      quantity:
        item.quantity,

      unitPrice:
        item.unit_price,

      /*
       * If your current insertOrderItem repository
       * supports these fields, pass them through.
       *
       * Otherwise the repository can continue using
       * only the fields it currently accepts.
       */
      selectedColor:
        item.selectedColor,

      selectedSize:
        item.selectedSize,
    });
  }

  /*
   * Use the internal DB order ID as the Razorpay receipt.
   */
  const receipt =
    buildRazorpayReceipt(
      internalOrderId
    );

  /*
   * Create Razorpay order.
   */
  const razorpayOrder =
    await createRazorpayOrder({
      amount,

      receipt,

      notes: {
        internalOrderId:
          String(
            internalOrderId
          ),

        userId:
          String(userId),
      },
    });

  /*
   * Store Razorpay order ID and amount
   * against the internal Dripzoid order.
   */
  await updateRazorpayOrder({
    orderId:
      internalOrderId,

    razorpayOrderId:
      razorpayOrder.id,

    razorpayAmount:
      razorpayOrder.amount,
  });

  /*
   * Return everything Flutter needs.
   */
  return {
    internalOrderId,

    razorpayOrderId:
      razorpayOrder.id,

    amount:
      razorpayOrder.amount,

    currency:
      razorpayOrder.currency ??
      "INR",
  };
}

/* =====================================================
   ✅ VERIFY PAYMENT
===================================================== */

export async function verifyPaymentService(
  {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    internalOrderId,
  },
  deps = {}
) {
  const _verifyPaymentSignature = deps.verifyPaymentSignature ?? verifyPaymentSignature;
  const _fetchPayment = deps.fetchPayment ?? fetchPayment;
  const _getOrderByPaymentId = deps.getOrderByPaymentId ?? getOrderByPaymentId;
  const _getOrderById = deps.getOrderById ?? getOrderById;
  const _getOrderItems = deps.getOrderItems ?? getOrderItems;
  const _confirmPayment = deps.confirmPayment ?? confirmPayment;
  const _createShiprocketOrder = deps.createShiprocketOrder ?? createShiprocketOrder;
  const _prisma = deps.prisma ?? prisma;
  const _reserveProductStock = deps.reserveProductStock ?? reserveProductStock;
  const _reserveProductSizeStock = deps.reserveProductSizeStock ?? reserveProductSizeStock;

  /*
   * Validate required Razorpay fields.
   */
  if (
    !razorpay_payment_id ||
    !razorpay_order_id ||
    !razorpay_signature
  ) {
    throw new AppError(
      "Missing payment fields",
      400
    );
  }

  /*
   * Verify Razorpay signature.
   */
  const isValid =
    _verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

  if (!isValid) {
    throw new AppError(
      "Invalid payment signature",
      400
    );
  }

  /*
   * Fetch payment directly from Razorpay.
   */
  const payment =
    await _fetchPayment(
      razorpay_payment_id
    );

  if (!payment) {
    throw new AppError(
      "Payment not found",
      404
    );
  }

  /*
   * Payment must be captured or authorized before
   * confirming the Dripzoid order.
   */
  if (
    payment.status !== "captured" &&
    payment.status !== "authorized"
  ) {
    throw new AppError(
      `Payment not completed (status: ${payment.status})`,
      400
    );
  }

  /*
   * Resolve internal Dripzoid order ID.
   */
  const notes =
    payment.notes || {};

  const orderId =
    internalOrderId ??
    notes.internalOrderId ??
    null;

  if (!orderId) {
    throw new AppError(
      "Missing internal order id",
      400
    );
  }

  /*
   * Strict Idempotency Check 1:
   * Has this Razorpay payment ID already been processed into an order?
   */
  const alreadyProcessed =
    await _getOrderByPaymentId(
      razorpay_payment_id
    );

  if (alreadyProcessed) {
    if (alreadyProcessed.status === "Confirmed") {
      return {
        message: "Payment already verified",
        internalOrderId: alreadyProcessed.id,
        orderNumber: alreadyProcessed.orderNumber,
        shiprocketOrderId:
          safeJsonParse(alreadyProcessed.paymentDetails)?.shiprocketOrderId ?? null,
        status: "Confirmed",
        alreadyProcessed: true,
      };
    }

    if (alreadyProcessed.status === "NeedsReconciliation") {
      return {
        message: "Payment captured, awaiting manual inventory reconciliation",
        internalOrderId: alreadyProcessed.id,
        orderNumber: alreadyProcessed.orderNumber,
        status: "NeedsReconciliation",
        alreadyProcessed: true,
        reconciliationRequired: true,
      };
    }
  }

  /*
   * Strict Idempotency Check 2:
   * Get the internal Dripzoid order by ID.
   */
  const order =
    await _getOrderById(
      orderId
    );

  if (!order) {
    throw new AppError(
      "Order not found",
      404
    );
  }

  if (order.status === "Confirmed") {
    return {
      message: "Order already confirmed",
      internalOrderId: order.id,
      orderNumber: order.orderNumber,
      shiprocketOrderId:
        safeJsonParse(order.paymentDetails)?.shiprocketOrderId ?? null,
      status: "Confirmed",
      alreadyProcessed: true,
    };
  }

  if (order.status === "NeedsReconciliation") {
    return {
      message: "Payment captured, awaiting manual inventory reconciliation",
      internalOrderId: order.id,
      orderNumber: order.orderNumber,
      status: "NeedsReconciliation",
      alreadyProcessed: true,
      reconciliationRequired: true,
    };
  }

  if (order.status === "Expired") {
    throw new AppError(
      "Order expired",
      410
    );
  }

  /*
   * Fetch order items.
   */
  const items =
    await _getOrderItems(
      orderId
    );

  /*
   * Shipping information stored with the pending order.
   */
  const shipping =
    safeJsonParse(
      order.shippingAddress,
      {}
    ) || {};

  /* =================================================
     📦 ATOMIC INVENTORY ALLOCATION
  ================================================= */
  let inventoryFailure = null;

  try {
    for (const item of items) {
      if (!item.productId) continue;

      const product = await _prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, stock: true },
      });

      if (!product) {
        throw new AppError(`Product ${item.productId} not found during fulfillment`, 404);
      }

      if (item.selectedSize) {
        await _reserveProductSizeStock(
          _prisma,
          item.productId,
          item.selectedSize,
          item.quantity
        );
      }

      await _reserveProductStock(
        _prisma,
        product,
        item.quantity
      );
    }
  } catch (invErr) {
    inventoryFailure = invErr;
    console.error("⚠️ Inventory allocation failed for captured payment:", invErr.message);
  }

  /* =================================================
     ⚠️ HANDLE INVENTORY ALLOCATION FAILURE (Captured Payment)
     If inventory cannot be reserved, customer payment has already
     been captured by Razorpay. Do NOT treat payment as failed or
     ask customer to pay again. Record captured state and flag for
     manual reconciliation.
  ================================================= */
  if (inventoryFailure) {
    const existingDetails = safeJsonParse(order.paymentDetails, {}) || {};
    await _prisma.order.update({
      where: { id: orderId },
      data: {
        status: "NeedsReconciliation",
        razorpayPaymentId: razorpay_payment_id,
        paymentDetails: {
          ...existingDetails,
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          paymentStatus: payment.status,
          reconciliationRequired: true,
          inventoryError: inventoryFailure.message,
          reconciliationNote: "Payment captured, but stock decrement failed. Manual inventory or refund reconciliation required.",
          capturedAt: new Date().toISOString(),
        },
      },
    });

    return {
      message: "Payment captured, but inventory allocation requires manual reconciliation",
      internalOrderId: orderId,
      orderNumber: order.orderNumber,
      status: "NeedsReconciliation",
      reconciliationRequired: true,
      error: inventoryFailure.message,
    };
  }

  /* =================================================
     🚚 CREATE SHIPROCKET ORDER (Non-blocking)
  ================================================= */
  let shiprocketOrder = null;

  try {
    const addressLine =
      [
        shipping.line1,
        shipping.line2,
      ]
        .filter(Boolean)
        .join(", ") ||
      shipping.address ||
      "N/A";

    shiprocketOrder =
      await _createShiprocketOrder({
        order_id:
          `ORDER-${orderId}`,

        order_date:
          new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),

        pickup_location:
          process.env.SHIPROCKET_PICKUP ||
          "PRIMARY",

        billing_customer_name:
          shipping.name ||
          shipping.customerName ||
          "Customer",

        billing_address:
          addressLine,

        billing_city:
          shipping.city ||
          "",

        billing_pincode:
          shipping.pincode ||
          "",

        billing_state:
          shipping.state ||
          "",

        billing_country:
          shipping.country ||
          "India",

        billing_email:
          shipping.email ||
          "",

        billing_phone:
          shipping.phone ||
          "",

        shipping_is_billing:
          true,

        payment_method:
          "Prepaid",

        sub_total:
          Number(
            order.totalAmount
          ) || 0,

        order_items:
          items.map((item) => ({
            name:
              item.product?.name ||
              item.product?.title ||
              `Product ${item.productId}`,

            sku:
              item.product?.sku ||
              `SKU-${item.productId}`,

            units:
              item.quantity,

            selling_price:
              item.unitPrice,
          })),

        weight: 1,
      });

    console.log(
      "🚚 Shiprocket Success:",
      JSON.stringify(
        shiprocketOrder,
        null,
        2
      )
    );
  } catch (err) {
    console.error(
      "Shiprocket failed:",
      err?.response?.data ||
        err?.message ||
        err
    );
  }

  /* =================================================
     💾 CONFIRM PAYMENT
  ================================================= */
  await _confirmPayment({
    orderId,
    paymentId:
      razorpay_payment_id,
    shiprocketOrderId:
      shiprocketOrder?.order_id ||
      null,
    status:
      "Confirmed",
  });

  /* =================================================
     🛒 CART CLEANUP (Only upon successful confirmation)
  ================================================= */
  if (order.userId) {
    try {
      await _prisma.cartItem.deleteMany({
        where: { userId: order.userId },
      });
    } catch (cartErr) {
      console.warn("⚠️ Could not clear cart after payment confirmation:", cartErr.message);
    }
  }

  return {
    message:
      "Payment verified successfully",

    internalOrderId:
      orderId,

    orderNumber:
      order.orderNumber,

    shiprocketOrderId:
      shiprocketOrder?.order_id ||
      null,

    status:
      "Confirmed",
  };
}
