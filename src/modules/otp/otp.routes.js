import express
  from "express";

import {
  sendOTP,
  verifyOTP,
} from "./otp.controller.js";

const router =
  express.Router();

/* =====================================================
   📧 SEND OTP
===================================================== */

router.post(
  "/send-otp",
  sendOTP
);

/* =====================================================
   ✅ VERIFY OTP
===================================================== */

router.post(
  "/verify-otp",
  verifyOTP
);

export default router;