// src/modules/payments/payment.service.js
import { AppError } from "../../errors/AppError.js";

import {
  createRazorpayOrder,
  verifyPaymentSignature,
  fetchPayment,
} from "../../integrations/razorpay/razorpay.service.js";

import { createShiprocketOrder } from "../../integrations/shiprocket/shiprocket.service.js";

import {
  createPaymentOrder,
  insertOrderItem,
  getOrderById,
  getOrderByPaymentId, // add this in repository for idempotency
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
    address: s.address ?? [line1, line2, city, state, pincode, country].filter(Boolean).join(", "),
  };
}

/* =====================================================
   💳 CREATE RAZORPAY ORDER
   Hybrid flow:
   - only creates Razorpay order
   - stores checkout data in Razorpay notes
   - does NOT create internal DB order yet
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

  /* =========================================
     💳 CREATE RAZORPAY ORDER
     Store checkout payload in notes for later
     verification + internal order creation
  ========================================= */

  const razorpayOrder = await createRazorpayOrder({
    amount,
    receipt: `checkout_${userId}_${Date.now()}`,
    notes: {
      flow: "hybrid_checkout",
      userId: String(userId),
      items: JSON.stringify(normalizedItems),
      shipping: JSON.stringify(normalizedShipping),
      totalAmount: String(totalAmount),
    },
  });

  /* =========================================
     ✅ RESPONSE
  ========================================= */

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency ?? "INR",
  };
}

/* =====================================================
   ✅ VERIFY PAYMENT
   Hybrid flow:
   - verify Razorpay signature + captured payment
   - read checkout payload from payment.notes
   - create internal order only here
   - insert order items
   - create Shiprocket order
   - confirm payment
===================================================== */

export async function verifyPaymentService({
  razorpay_payment_id,
  razorpay_order_id,
  razorpay_signature,
}) {
  /* =========================================
     VALIDATION
  ========================================= */

  if (
    !razorpay_payment_id ||
    !razorpay_order_id ||
    !razorpay_signature
  ) {
    throw new AppError("Missing payment fields", 400);
  }

  /* =========================================
     🔐 VERIFY SIGNATURE FIRST
  ========================================= */

  const isValid = verifyPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    throw new AppError("Invalid payment signature", 400);
  }

  /* =========================================
     🔍 FETCH PAYMENT
  ========================================= */

  const payment = await fetchPayment(razorpay_payment_id);

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  if (payment.status !== "captured") {
    throw new AppError("Payment not captured", 400);
  }

  /* =========================================
     🧾 EXTRACT CHECKOUT DATA FROM NOTES
  ========================================= */

  const notes = payment.notes || {};

  const userId = notes.userId ?? null;
  const items = normalizeItems(safeJsonParse(notes.items, []));
  const shipping = normalizeShipping(safeJsonParse(notes.shipping, {}));
  const totalAmount = Number(notes.totalAmount ?? 0);

  if (!userId) {
    throw new AppError("Missing checkout user data", 400);
  }

  if (!items.length) {
    throw new AppError("Missing checkout items", 400);
  }

  if (!totalAmount || totalAmount <= 0) {
    throw new AppError("Invalid checkout total", 400);
  }

  /* =========================================
     🔁 IDEMPOTENCY
     If this payment already created an order,
     return existing result instead of duplicating.
  ========================================= */

  const existing = getOrderByPaymentId
    ? getOrderByPaymentId(razorpay_payment_id)
    : null;

  if (existing) {
    return {
      message: "Already processed",
      internalOrderId: existing.id,
      shiprocketOrderId: existing.shiprocket_order_id ?? null,
      status: existing.status ?? "Confirmed",
    };
  }

  /* =========================================
     💾 CREATE INTERNAL ORDER NOW
     (after successful payment verification)
  ========================================= */

  const orderId = createPaymentOrder({
    userId,
    shippingJson: JSON.stringify(shipping),
    totalAmount,
  });

  /* =========================================
     💾 INSERT ORDER ITEMS
  ========================================= */

  for (const item of items) {
    insertOrderItem({
      orderId,
      productId: item.product_id,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    });
  }

  /* =========================================
     💾 SAVE RAZORPAY METADATA ON INTERNAL ORDER
  ========================================= */

  updateRazorpayOrder({
    orderId,
    razorpayOrderId: razorpay_order_id,
    razorpayAmount: payment.amount ?? Math.round(totalAmount * 100),
  });

  /* =========================================
     🚚 CREATE SHIPROCKET ORDER
  ========================================= */

  let shiprocketOrder = null;

  try {
    const addressLine = [
      shipping.line1,
      shipping.line2,
    ].filter(Boolean).join(", ") || shipping.address || "N/A";

    shiprocketOrder = await createShiprocketOrder({
      order_id: `ORDER-${orderId}`,
      order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
      pickup_location: process.env.SHIPROCKET_PICKUP || "PRIMARY",

      billing_customer_name: shipping.name || "Customer",
      billing_address: addressLine,
      billing_city: shipping.city || "",
      billing_pincode: shipping.pincode || "",
      billing_state: shipping.state || "",
      billing_country: shipping.country || "India",
      billing_email: shipping.email || "",
      billing_phone: shipping.phone || "",

      shipping_is_billing: true,
      payment_method: "Prepaid",
      sub_total: totalAmount,

      order_items: items.map((i) => ({
        name: i.name || `Product ${i.product_id}`,
        sku: i.sku || `SKU-${i.product_id}`,
        units: i.quantity,
        selling_price: i.unit_price,
      })),

      weight: 1,
    });
  } catch (err) {
    console.error("Shiprocket failed:", err.message);
  }

  /* =========================================
     💾 CONFIRM PAYMENT / FINALIZE ORDER
  ========================================= */

  confirmPayment({
    orderId,
    paymentId: razorpay_payment_id,
    shiprocketOrderId: shiprocketOrder?.order_id || null,
    status: shiprocketOrder ? "Confirmed" : "Processing",
  });

  /* =========================================
     ✅ RESPONSE
  ========================================= */

  return {
    message: "Payment verified successfully",
    internalOrderId: orderId,
    shiprocketOrderId: shiprocketOrder?.order_id || null,
    status: shiprocketOrder ? "Confirmed" : "Processing",
  };
}
