// src/integrations/razorpay/razorpay.service.js
import Razorpay from "razorpay";
import crypto from "crypto";
import { IntegrationError } from "../../errors/IntegrationError.js";

/* =====================================================
   VALIDATE ENV
===================================================== */

function assertRazorpayConfig() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new IntegrationError(
      "Razorpay credentials are missing",
      500,
      {
        keyIdPresent: Boolean(process.env.RAZORPAY_KEY_ID),
        keySecretPresent: Boolean(process.env.RAZORPAY_KEY_SECRET),
      }
    );
  }
}

/* =====================================================
   💳 RAZORPAY CLIENT
===================================================== */

assertRazorpayConfig();

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* =====================================================
   HELPERS
===================================================== */

function toIntegrationDetails(err) {
  return {
    message: err?.message ?? "Unknown Razorpay error",
    code: err?.code ?? null,
    statusCode: err?.statusCode ?? null,
    responseData: err?.response?.data ?? null,
    error: err,
  };
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
    console.error("Razorpay Create Order Error (full):", err);
    console.error("Razorpay Create Order Error details:", toIntegrationDetails(err));

    throw new IntegrationError(
      "Failed to create Razorpay order",
      502,
      toIntegrationDetails(err)
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
    console.error("Fetch Payment Error (full):", err);
    console.error("Fetch Payment Error details:", toIntegrationDetails(err));

    throw new IntegrationError(
      "Failed to fetch payment",
      502,
      toIntegrationDetails(err)
    );
  }
}
