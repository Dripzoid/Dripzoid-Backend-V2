import {
  sendOTPEmail,
} from "../../integrations/msg91/msg91.service.js";

import {
  upsertOTP,
  getOTPByEmail,
  deleteOTP,
  incrementOTPAttempts,
} from "./otp.repository.js";

import {
  hashOTP,
  generateOTP,
} from "./otp.utils.js";

import {
  AppError,
} from "../../errors/AppError.js";

const OTP_VALIDITY =
  parseInt(
    process.env.OTP_EXPIRY_SECONDS
  ) || 300;

const OTP_MAX_ATTEMPTS =
  parseInt(
    process.env.OTP_MAX_ATTEMPTS
  ) || 3;

/* =====================================================
   📧 SEND OTP
===================================================== */

export async function sendOTPService(
  email
) {
  email =
    email
      ?.toLowerCase()
      ?.trim();

  if (!email) {
    throw new AppError(
      "Email required",
      400
    );
  }

  const otp =
    generateOTP();

  const otpHash =
    hashOTP(otp);

  const now =
    Math.floor(
      Date.now() / 1000
    );

  /* =========================================
     💾 STORE OTP
  ========================================= */

  await upsertOTP({
    email,
    otpHash,
    createdAt: now,
  });

  /* =========================================
     📧 SEND EMAIL
  ========================================= */

  await sendOTPEmail({
    email,
    otp,
  });

  return {
    success: true,
    message: "OTP sent successfully",
  };
}

/* =====================================================
   ✅ VERIFY OTP
===================================================== */

export async function verifyOTPService({
  email,
  otp,
}) {
  email =
    email
      ?.toLowerCase()
      ?.trim();

  if (!email || !otp) {
    throw new AppError(
      "Email and OTP required",
      400
    );
  }

  const row =
  await getOTPByEmail(email);

if (!row) {
  throw new AppError(
    "No OTP found",
    400
  );
}

const otpCreatedAt =
  Number(row.otpCreatedAt);

const attempts =
  Number(row.attempts);

const now =
  Math.floor(
    Date.now() / 1000
  );

/* =========================================
   ⏳ OTP EXPIRY
========================================= */

if (
  now - otpCreatedAt >
  OTP_VALIDITY
) {
  throw new AppError(
    "OTP expired",
    400
  );
}

/* =========================================
   🚫 MAX ATTEMPTS
========================================= */

if (
  attempts >=
  OTP_MAX_ATTEMPTS
) {
  throw new AppError(
    "Maximum attempts reached",
    400
  );
}

  /* =========================================
     ❌ INVALID OTP
  ========================================= */

  if (
    row.otpHash !==
    hashOTP(otp)
  ) {
    await incrementOTPAttempts(
      email
    );

    throw new AppError(
      "Invalid OTP",
      400
    );
  }

  /* =========================================
     ✅ DELETE VERIFIED OTP
  ========================================= */

  await deleteOTP(email);

  return {
    success: true,
    message: "OTP verified successfully",
  };
}
