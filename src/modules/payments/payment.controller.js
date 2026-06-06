// src/modules/payments/payment.controller.js
import {
  createRazorpayOrderService,
  verifyPaymentService,
} from "./payment.service.js";

/* =====================================================
   💳 CREATE RAZORPAY ORDER
===================================================== */

export async function createRazorpayOrder(req, res, next) {
  try {
    const { items, shipping, totalAmount } = req.body;

    const userId = req.user?.id;

    const result = await createRazorpayOrderService({
      userId,
      items,
      shipping,
      totalAmount,
    });

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   ✅ VERIFY PAYMENT
   Hybrid flow:
   - no internalOrderId is needed from frontend anymore
   - order is created after payment verification
===================================================== */

export async function verifyPayment(req, res, next) {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;

    const result = await verifyPaymentService({
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}
