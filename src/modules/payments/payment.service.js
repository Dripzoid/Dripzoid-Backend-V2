import {
  AppError,
} from "../../errors/AppError.js";

import {
  createRazorpayOrder,
  verifyPaymentSignature,
  fetchPayment,
} from "../../integrations/razorpay/razorpay.service.js";

import {
  createShiprocketOrder,
} from "../../integrations/shiprocket/shiprocket.service.js";

import {
  createPaymentOrder,
  insertOrderItem,
  getOrderById,
  getOrderItems,
  updateRazorpayOrder,
  confirmPayment,
} from "./payment.repository.js";

/* =====================================================
   💳 CREATE RAZORPAY ORDER
===================================================== */

export async function createRazorpayOrderService({
  userId,
  items,
  shipping,
  totalAmount,
}) {

  /* =========================================
     VALIDATION
  ========================================= */

  if (!userId) {

    throw new AppError(
      "Unauthorized",
      401
    );
  }

  if (
    !Array.isArray(items) ||
    !items.length
  ) {

    throw new AppError(
      "No items provided",
      400
    );
  }

  const amount =
    Math.round(
      Number(totalAmount) * 100
    );

  if (
    !amount ||
    amount <= 0
  ) {

    throw new AppError(
      "Invalid amount",
      400
    );
  }

  /* =========================================
     💾 CREATE INTERNAL ORDER
  ========================================= */

  const orderId =
    createPaymentOrder({
      userId,

      shippingJson:
        JSON.stringify(shipping),

      totalAmount,
    });

  /* =========================================
     💾 INSERT ITEMS
  ========================================= */

  for (const item of items) {

    insertOrderItem({
      orderId,

      productId:
        item.product_id,

      quantity:
        item.quantity,

      unitPrice:
        item.unit_price,
    });
  }

  /* =========================================
     💳 CREATE RAZORPAY ORDER
  ========================================= */

  const razorpayOrder =
    await createRazorpayOrder({
      amount,

      receipt:
        `order_${orderId}`,

      notes: {
        internalOrderId:
          String(orderId),
      },
    });

  /* =========================================
     💾 SAVE RAZORPAY ORDER
  ========================================= */

  updateRazorpayOrder({
    orderId,

    razorpayOrderId:
      razorpayOrder.id,

    razorpayAmount:
      razorpayOrder.amount,
  });

  /* =========================================
     ✅ RESPONSE
  ========================================= */

  return {
    internalOrderId:
      orderId,

    razorpayOrderId:
      razorpayOrder.id,

    amount:
      razorpayOrder.amount,
  };
}

/* =====================================================
   ✅ VERIFY PAYMENT
===================================================== */

export async function verifyPaymentService({
  razorpay_payment_id,
  razorpay_order_id,
  razorpay_signature,
  internalOrderId,
}) {

  /* =========================================
     VALIDATION
  ========================================= */

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

  /* =========================================
     🔍 GET ORDER
  ========================================= */

  const order =
    getOrderById(
      internalOrderId
    );

  if (!order) {

    throw new AppError(
      "Order not found",
      404
    );
  }

  /* =========================================
     🔁 IDEMPOTENCY
  ========================================= */

  if (
    order.status ===
    "Confirmed"
  ) {

    return {
      message:
        "Already processed",

      shiprocketOrderId:
        order.shiprocket_order_id,
    };
  }

  /* =========================================
     🔐 VERIFY SIGNATURE
  ========================================= */

  const isValid =
    verifyPaymentSignature({
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

  /* =========================================
     🔍 VERIFY PAYMENT
  ========================================= */

  const payment =
    await fetchPayment(
      razorpay_payment_id
    );

  if (
    payment.status !==
    "captured"
  ) {

    throw new AppError(
      "Payment not captured",
      400
    );
  }

  /* =========================================
     📦 GET ORDER ITEMS
  ========================================= */

  const items =
    getOrderItems(
      internalOrderId
    );

  const address =
    JSON.parse(
      order.shipping_json
    );

  /* =========================================
     🚚 CREATE SHIPROCKET ORDER
  ========================================= */

  let shiprocketOrder =
    null;

  try {

    shiprocketOrder =
      await createShiprocketOrder({
        order_id:
          `ORDER-${internalOrderId}`,

        order_date:
          new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),

        pickup_location:
          process.env
            .SHIPROCKET_PICKUP ||
          "PRIMARY",

        billing_customer_name:
          address.name ||
          "Customer",

        billing_address:
          address.address ||
          "N/A",

        billing_city:
          address.city,

        billing_pincode:
          address.pincode,

        billing_state:
          address.state,

        billing_country:
          "India",

        billing_email:
          address.email,

        billing_phone:
          address.phone,

        shipping_is_billing:
          true,

        payment_method:
          "Prepaid",

        sub_total:
          order.total_amount,

        order_items:
          items.map((i) => ({
            name:
              `Product ${i.product_id}`,

            sku:
              `SKU-${i.product_id}`,

            units:
              i.quantity,

            selling_price:
              i.unit_price,
          })),

        weight: 1,
      });

  } catch (err) {

    console.error(
      "Shiprocket failed:",
      err.message
    );
  }

  /* =========================================
     💾 UPDATE ORDER
  ========================================= */

  confirmPayment({
    orderId:
      internalOrderId,

    paymentId:
      razorpay_payment_id,

    shiprocketOrderId:
      shiprocketOrder
        ?.order_id || null,

    status:
      shiprocketOrder
        ? "Confirmed"
        : "Processing",
  });

  /* =========================================
     ✅ RESPONSE
  ========================================= */

  return {
    message:
      "Payment verified successfully",

    shiprocketOrderId:
      shiprocketOrder
        ?.order_id || null,
  };
}