import express
  from "express";

import { authenticateToken as authMiddleware }
  from "../../middlewares/auth.middleware.js";

import {
  createRazorpayOrder,
  verifyPayment,
} from "./payment.controller.js";

const router =
  express.Router();

/* =====================================================
   💳 CREATE RAZORPAY ORDER
===================================================== */

router.post(
  "/razorpay/create-order",

  authMiddleware,

  createRazorpayOrder
);

/* =====================================================
   ✅ VERIFY PAYMENT
===================================================== */

router.post(
  "/razorpay/verify",

  authMiddleware,

  verifyPayment
);

export default router;