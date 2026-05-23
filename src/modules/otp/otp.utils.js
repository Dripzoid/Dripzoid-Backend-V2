import crypto from "crypto";

/* =====================================================
   🔒 HASH OTP
===================================================== */

export function hashOTP(
  otp
) {

  return crypto
    .createHash("sha256")
    .update(String(otp))
    .digest("hex");
}

/* =====================================================
   🎲 GENERATE OTP
===================================================== */

export function generateOTP() {

  return Math.floor(
    100000 +
    Math.random() * 900000
  ).toString();
}

/* =====================================================
   🙈 MASK EMAIL
===================================================== */

export function maskEmail(
  email
) {

  if (!email) return "";

  const [user, domain] =
    email.split("@");

  return (
    user[0] +
    "***@" +
    domain
  );
}

/* =====================================================
   🙈 MASK OTP
===================================================== */

export function maskOTP(
  otp
) {

  if (!otp) return "";

  return (
    otp.slice(0, 1) +
    "***" +
    otp.slice(-1)
  );
}