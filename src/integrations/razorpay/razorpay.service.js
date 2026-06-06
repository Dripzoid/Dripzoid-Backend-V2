// src/integrations/razorpay/razorpay.service.js
import Razorpay from "razorpay";
import crypto from "crypto";
import { IntegrationError } from "../../errors/IntegrationError.js";

/* =====================================================
   ENV CHECK
===================================================== */

function assertRazorpayConfig() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new IntegrationError(
      "Razorpay credentials are missing",
      {
        keyIdPresent: Boolean(process.env.RAZORPAY_KEY_ID),
        keySecretPresent: Boolean(process.env.RAZORPAY_KEY_SECRET),
      },
      500
    );
  }
}

assertRazorpayConfig();

/* =====================================================
   💳 RAZORPAY CLIENT
===================================================== */

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* =====================================================
   HELPERS
===================================================== */

function toErrorDetails(err) {
  return {
    message: err?.message ?? "Unknown Razorpay error",
    code: err?.code ?? null,
    statusCode: err?.statusCode ?? null,
    responseData: err?.response?.data ?? null,
    raw: err,
  };
}

export function buildRazorpayReceipt(orderId = "") {
  const compactOrderId = String(orderId)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 20);

  const timePart = Date.now().toString(36).slice(-8);
  const randPart = crypto.randomBytes(3).toString("hex");

  const receipt = `dz_${compactOrderId}_${timePart}_${randPart}`;

  return receipt.slice(0, 40);
}

/* =====================================================
   💳 CREATE RAZORPAY ORDER
===================================================== */

export async function createRazorpayOrder({
  amount,
  receipt,
  notes = {},
}) {
  try {
    return await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      notes,
    });
  } catch (err) {
    const details = toErrorDetails(err);

    console.error("Razorpay Create Order Error (full):", err);
    console.error("Razorpay Create Order Error details:", details);

    throw new IntegrationError(
      "Failed to create Razorpay order",
      details,
      502
    );
  }
}

/* =====================================================
   ✅ VERIFY PAYMENT SIGNATURE
===================================================== */

export function verifyPaymentSignature({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  return expected === razorpay_signature;
}

/* =====================================================
   🔍 FETCH PAYMENT
===================================================== */

export async function fetchPayment(paymentId) {
  try {
    return await razorpay.payments.fetch(paymentId);
  } catch (err) {
    const details = toErrorDetails(err);

    console.error("Fetch Payment Error (full):", err);
    console.error("Fetch Payment Error details:", details);

    throw new IntegrationError(
      "Failed to fetch payment",
      details,
      502
    );
  }
}
