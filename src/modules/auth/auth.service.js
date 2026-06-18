import bcrypt from "bcryptjs";
import crypto from "crypto";

import prisma from "../../lib/prisma.js";
import { triggerAutomationEvent } from "../../integrations/automation/automation.service.js";
import { EVENT_TYPES } from "../../config/eventTypes.js";

/* ======================================================
   USER REGISTERED AUTOMATION HELPER
====================================================== */

async function queueUserRegisteredEvent(user) {
  const payload = {
    customer_name: user.name,
    email: user.email,
    user_id: user.id,
    registered_at: new Date().toISOString(),
  };

  const automationEvent =
    await prisma.automationEvent.create({
      data: {
        eventType: EVENT_TYPES.USER_REGISTERED,
        payload,
        status: "pending",
        retryCount: 0,
      },
    });

  try {
    await triggerAutomationEvent(
      EVENT_TYPES.USER_REGISTERED,
      payload
    );

    await prisma.automationEvent.update({
      where: {
        id: automationEvent.id,
      },
      data: {
        status: "completed",
        processedAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    console.error(
      "Automation USER_REGISTERED failed:",
      error.message
    );

    await prisma.automationEvent.update({
      where: {
        id: automationEvent.id,
      },
      data: {
        retryCount: {
          increment: 1,
        },
        lastError: error.message,
        status: "pending",
      },
    });
  }

  return automationEvent;
}

/* ======================================================
   REGISTER USER
====================================================== */

export async function registerUser({
  name,
  email,
  phone,
  mobile,
  password,
  gender,
  dob,
}) {
  const normalizedEmail = email.toLowerCase().trim();

  if (!password) {
    throw new Error("Password is required");
  }

  /* =========================
     SUPPORT PHONE OR MOBILE
  ========================= */

  const phoneValue = phone || mobile || "";

  /* =========================
     CHECK EXISTING USER
  ========================= */

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (existingUser) {
    throw new Error("Email already registered");
  }

  /* =========================
     HASH PASSWORD
  ========================= */

  const hashedPassword = await bcrypt.hash(password, 10);

  /* =========================
     CREATE USER
  ========================= */

  const user = await prisma.user.create({
    data: {
      name: name || "",
      email: normalizedEmail,
      phone: phoneValue,
      password: hashedPassword,
      gender: gender || null,
      dob: dob ? new Date(dob) : null,
      isAdmin: false,
    },
  });

  /* =========================
     AUTOMATION EVENT
  ========================= */

 try {
  await queueUserRegisteredEvent(user);
} catch (error) {
  console.error(
    "Failed to queue USER_REGISTERED automation:",
    error.message
  );
}

  return user;
}

/* ======================================================
   LOGIN USER
====================================================== */

export async function loginUser({
  email,
  password,
}) {
  const normalizedEmail = email.toLowerCase().trim();

  /* =========================
     FIND USER
  ========================= */

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user) {
    throw new Error(
      "User not found. Please register first."
    );
  }

  if (!user.password) {
    throw new Error(
      "This account uses Google Sign-In. Please continue with Google."
    );
  }

  /* =========================
     VERIFY PASSWORD
  ========================= */

  const isMatch = await bcrypt.compare(
    password,
    user.password
  );

  if (!isMatch) {
    throw new Error("Incorrect password");
  }

  return user;
}

/* ======================================================
   GOOGLE AUTH
====================================================== */

export async function handleGoogleAuth(profile) {
  const email = (profile?.emails?.[0]?.value || "")
    .toLowerCase()
    .trim();

  const name = profile.displayName || "Google User";

  if (!email) {
    throw new Error("Google account has no email");
  }

  /* =========================
     CHECK EXISTING USER
  ========================= */

  let user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (user) {
    return user;
  }

  /* =========================
     CREATE RANDOM PASSWORD
  ========================= */

  const randomPassword = crypto.randomBytes(16).toString("hex");

  const hashedPassword = await bcrypt.hash(randomPassword, 10);

  /* =========================
     CREATE GOOGLE USER
  ========================= */

  user = await prisma.user.create({
    data: {
      name,
      email,
      phone: "",
      password: hashedPassword,
      isAdmin: false,
    },
  });

  /* =========================
     AUTOMATION EVENT
  ========================= */

 try {
  await queueUserRegisteredEvent(user);
} catch (error) {
  console.error(
    "Failed to queue USER_REGISTERED automation:",
    error.message
  );
}

  return user;
}

/* ======================================================
   RESET PASSWORD
====================================================== */

export async function resetUserPassword({
  email,
  password,
}) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: {
      email: normalizedEmail,
    },
    data: {
      password: hashedPassword,
    },
  });

  return true;
}
