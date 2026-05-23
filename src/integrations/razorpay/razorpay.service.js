import Razorpay
  from "razorpay";

import crypto
  from "crypto";

import {
  IntegrationError,
} from "../../errors/IntegrationError.js";

/* =====================================================
   💳 RAZORPAY CLIENT
===================================================== */

export const razorpay =
  new Razorpay({
    key_id:
      process.env
        .RAZORPAY_KEY_ID,

    key_secret:
      process.env
        .RAZORPAY_KEY_SECRET,
  });

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

    console.error(
      "Razorpay Create Order Error:",
      err?.response?.data ||
        err.message
    );

    throw new IntegrationError(
      "Failed to create Razorpay order",

      err?.response?.data ||
        err.message
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

  const expected =
    crypto
      .createHmac(
        "sha256",
        process.env
          .RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

  return (
    expected ===
    razorpay_signature
  );
}

/* =====================================================
   🔍 FETCH PAYMENT
===================================================== */

export async function fetchPayment(
  paymentId
) {

  try {

    return await razorpay
      .payments
      .fetch(paymentId);

  } catch (err) {

    console.error(
      "Fetch Payment Error:",
      err?.response?.data ||
        err.message
    );

    throw new IntegrationError(
      "Failed to fetch payment",

      err?.response?.data ||
        err.message
    );
  }
}