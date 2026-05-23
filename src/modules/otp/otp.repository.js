import prisma from "../../lib/prisma.js";

/* =====================================================
   💾 UPSERT OTP
===================================================== */

export async function upsertOTP({
  email,
  otpHash,
  createdAt,
}) {
  if (!email || !otpHash) {
    throw new Error(
      "Email and OTP hash required"
    );
  }

  const normalizedEmail =
    email.toLowerCase().trim();

  /* =========================
     UPSERT OTP
  ========================= */

  return prisma.otpData.upsert({
    where: {
      email:
        normalizedEmail,
    },

    update: {
      otpHash,

      otpCreatedAt:
        createdAt,

      attempts: 0,
    },

    create: {
      email:
        normalizedEmail,

      otpHash,

      otpCreatedAt:
        createdAt,

      attempts: 0,
    },
  });
}

/* =====================================================
   🔍 GET OTP
===================================================== */

export async function getOTPByEmail(
  email
) {
  if (!email) {
    throw new Error(
      "Email required"
    );
  }

  const normalizedEmail =
    email.toLowerCase().trim();

  /* =========================
     FETCH OTP
  ========================= */

  return prisma.otpData.findUnique({
    where: {
      email:
        normalizedEmail,
    },

    select: {
      otpHash: true,

      otpCreatedAt: true,

      attempts: true,
    },
  });
}

/* =====================================================
   ❌ DELETE OTP
===================================================== */

export async function deleteOTP(
  email
) {
  if (!email) {
    throw new Error(
      "Email required"
    );
  }

  const normalizedEmail =
    email.toLowerCase().trim();

  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingOTP =
    await prisma.otpData.findUnique({
      where: {
        email:
          normalizedEmail,
      },
    });

  if (!existingOTP) {
    return false;
  }

  /* =========================
     DELETE OTP
  ========================= */

  await prisma.otpData.delete({
    where: {
      email:
        normalizedEmail,
    },
  });

  return true;
}

/* =====================================================
   ➕ INCREMENT ATTEMPTS
===================================================== */

export async function incrementOTPAttempts(
  email
) {
  if (!email) {
    throw new Error(
      "Email required"
    );
  }

  const normalizedEmail =
    email.toLowerCase().trim();

  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingOTP =
    await prisma.otpData.findUnique({
      where: {
        email:
          normalizedEmail,
      },
    });

  if (!existingOTP) {
    throw new Error(
      "OTP record not found"
    );
  }

  /* =========================
     INCREMENT ATTEMPTS
  ========================= */

  return prisma.otpData.update({
    where: {
      email:
        normalizedEmail,
    },

    data: {
      attempts: {
        increment: 1,
      },
    },
  });
}