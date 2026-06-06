// src/modules/payments/payment.service.js
import { AppError } from "../../errors/AppError.js";

import {
  createRazorpayOrder,
  verifyPaymentSignature,
  fetchPayment,
  buildRazorpayReceipt,
} from "../../integrations/razorpay/razorpay.service.js";

import { createShiprocketOrder } from "../../integrations/shiprocket/shiprocket.service.js";

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
      product_id: item?.product_id ?? item?.productId ?? item?.id ?? null,
      quantity: Number(item?.quantity ?? item?.qty ?? 1),
      unit_price: Number(item?.unit_price ?? item?.unitPrice ?? item?.price ?? 0),
      selectedColor: item?.selectedColor ?? item?.color ?? null,
      selectedSize: item?.selectedSize ?? item?.size ?? null,
      variantId: item?.variantId ?? item?.variant_id ?? null,
      name: item?.name ?? item?.product_name ?? item?.title ?? null,
      sku: item?.sku ?? null,
    }))
    .filter((item) => item.product_id && item.quantity > 0);
}

function normalizeShipping(shipping) {
  const s = shipping && typeof shipping === "object" ? shipping : {};

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

  const city = s.city ?? s.town ?? "";
  const state = s.state ?? "";
  const pincode = s.pincode ?? s.postcode ?? s.zip ?? "";
  const country = s.country ?? "India";

  return {
    ...s,
    name: s.name ?? s.customerName ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    line1,
    line2,
    city,
    state,
    pincode,
    country,
    address:
      s.address ??
      [line1, line2, city, state, pincode, country].filter(Boolean).join(", "),
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
    throw new AppError("Unauthorized", 401);
  }

  if (!Array.isArray(items) || !items.length) {
    throw new AppError("No items provided", 400);
  }

  const normalizedItems = normalizeItems(items);
  if (!normalizedItems.length) {
    throw new AppError("No valid items provided", 400);
  }

  const normalizedShipping = normalizeShipping(shipping);

  const amount = Math.round(Number(totalAmount) * 100);
  if (!amount || amount <= 0) {
    throw new AppError("Invalid amount", 400);
  }

  const internalOrderId = await createPaymentOrder({
    userId,
    shippingJson: JSON.stringify(normalizedShipping),
    totalAmount,
    status: "Pending",
  });

  for (const item of normalizedItems) {
    await insertOrderItem({
      orderId: internalOrderId,
      productId: item.product_id,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    });
  }

  const receipt = buildRazorpayReceipt(internalOrderId);

  const razorpayOrder = await createRazorpayOrder({
    amount,
    receipt,
    notes: {
      internalOrderId: String(internalOrderId),
      userId: String(userId),
    },
  });

  await updateRazorpayOrder({
    orderId: internalOrderId,
    razorpayOrderId: razorpayOrder.id,
    razorpayAmount: razorpayOrder.amount,
  });

  return {
    internalOrderId,
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency ?? "INR",
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
  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    throw new AppError("Missing payment fields", 400);
  }

  const isValid = verifyPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    throw new AppError("Invalid payment signature", 400);
  }

  const payment = await fetchPayment(razorpay_payment_id);
  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  if (payment.status !== "captured") {
    throw new AppError("Payment not captured", 400);
  }

  const notes = payment.notes || {};
  const orderId = internalOrderId ?? notes.internalOrderId ?? null;

  if (!orderId) {
    throw new AppError("Missing internal order id", 400);
  }

  const alreadyProcessed = await getOrderByPaymentId(razorpay_payment_id);
  if (alreadyProcessed?.status === "Confirmed") {
    return {
      message: "Already processed",
      internalOrderId: alreadyProcessed.id,
      shiprocketOrderId: alreadyProcessed.shiprocketOrderId ?? null,
      status: "Confirmed",
    };
  }

  const order = await getOrderById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.status === "Confirmed") {
    return {
      message: "Already processed",
      internalOrderId: order.id,
      shiprocketOrderId: order.shiprocketOrderId ?? null,
      status: "Confirmed",
    };
  }

  if (order.status === "Expired") {
    throw new AppError("Order expired", 410);
  }

  const items = await getOrderItems(orderId);
  const shipping = order.shippingAddress || {};

  let shiprocketOrder = null;

  try {
    const addressLine =
      [shipping.line1, shipping.line2].filter(Boolean).join(", ") ||
      shipping.address ||
      "N/A";

    shiprocketOrder = await createShiprocketOrder({
      order_id: `ORDER-${orderId}`,
      order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
      pickup_location: process.env.SHIPROCKET_PICKUP || "PRIMARY",

      billing_customer_name: shipping.name || shipping.customerName || "Customer",
      billing_address: addressLine,
      billing_city: shipping.city || "",
      billing_pincode: shipping.pincode || "",
      billing_state: shipping.state || "",
      billing_country: shipping.country || "India",
      billing_email: shipping.email || "",
      billing_phone: shipping.phone || "",

      shipping_is_billing: true,
      payment_method: "Prepaid",
      sub_total: Number(order.totalAmount) || 0,

      order_items: items.map((i) => ({
        name: i.product?.name || i.product?.title || `Product ${i.productId}`,
        sku: i.product?.sku || `SKU-${i.productId}`,
        units: i.quantity,
        selling_price: i.unitPrice,
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
  err.message ||
  err
);
  }

  console.log(
  "💾 Saving Shiprocket Order ID:",
  shiprocketOrder?.order_id
);

  await confirmPayment({
    orderId,
    paymentId: razorpay_payment_id,
    shiprocketOrderId: shiprocketOrder?.order_id || null,
    status: "Confirmed",
  });

  return {
    message: "Payment verified successfully",
    internalOrderId: orderId,
    shiprocketOrderId: shiprocketOrder?.order_id || null,
    status: "Confirmed",
  };
}
