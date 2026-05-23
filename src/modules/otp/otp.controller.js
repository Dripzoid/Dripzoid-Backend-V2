import {
  sendOTPService,
  verifyOTPService,
} from "./otp.service.js";

/* =====================================================
   📧 SEND OTP
===================================================== */

export async function sendOTP(
  req,
  res,
  next
) {

  try {

    const result =
      await sendOTPService(
        req.body?.email
      );

    return res.json(result);

  } catch (error) {

    next(error);
  }
}

/* =====================================================
   ✅ VERIFY OTP
===================================================== */

export async function verifyOTP(
  req,
  res,
  next
) {

  try {

    const result =
      await verifyOTPService({
        email:
          req.body?.email,

        otp:
          req.body?.otp,
      });

    return res.json(result);

  } catch (error) {

    next(error);
  }
}