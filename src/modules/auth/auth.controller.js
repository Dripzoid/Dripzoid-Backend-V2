import jwt from "jsonwebtoken";
import passport from "passport";

import prisma from "../../lib/prisma.js";

import { getDevice, getIP } from "../../utils/device.js";
import { insertUserActivity } from "../../utils/activity.js";

import {
  registerUser,
  loginUser,
  handleGoogleAuth,
} from "./auth.service.js";

const JWT_SECRET =
  process.env.JWT_SECRET;

const CLIENT_URL =
  process.env.CLIENT_URL;

/* ======================================================
   SESSION CREATION
====================================================== */

async function createSession(user, req) {
  const session =
    await prisma.userSession.create({
      data: {
        userId: user.id,

        device: getDevice(req),

        ip: getIP(req),

        lastActive: new Date(),
      },
    });

  return session.id;
}

/* ======================================================
   REGISTER
====================================================== */

export const register = async (
  req,
  res
) => {
  try {
    let {
      name,
      email,
      phone,
      mobile,
      password,
      gender,
      dob,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email & password required",
      });
    }

    email = email.toLowerCase().trim();

    const user =
      await registerUser({
        name,
        email,
        phone,
        mobile,
        password,
        gender,
        dob,
      });

    /* =========================
       CREATE SESSION
    ========================= */

    const sessionId =
      await createSession(user, req);

    /* =========================
       USER ACTIVITY
    ========================= */

    await insertUserActivity(
      user.id,
      "Registered & Logged In"
    );

    /* =========================
       JWT TOKEN
    ========================= */

    const token = jwt.sign(
      {
        id: user.id,

        email: user.email,

        is_admin:
          user.is_admin,

        sessionId,
      },

      JWT_SECRET,

      {
        expiresIn: "180d",
      }
    );

    return res.status(201).json({
      message:
        "User registered successfully",

      token,

      sessionId,

      user,
    });
  } catch (err) {
    console.error(
      "Register Error:",
      err
    );

    return res.status(400).json({
      message:
        err.message ||
        "Registration failed",
    });
  }
};

/* ======================================================
   LOGIN
====================================================== */

export const login = async (
  req,
  res
) => {
  try {
    let { email, password } =
      req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email & password required",
      });
    }

    email = email.toLowerCase().trim();

    const user =
      await loginUser({
        email,
        password,
      });

    /* =========================
       CREATE SESSION
    ========================= */

    const sessionId =
      await createSession(user, req);

    /* =========================
       USER ACTIVITY
    ========================= */

    await insertUserActivity(
      user.id,
      "Logged In"
    );

    /* =========================
       JWT TOKEN
    ========================= */

    const token = jwt.sign(
      {
        id: user.id,

        email: user.email,

        is_admin:
          user.is_admin,

        sessionId,
      },

      JWT_SECRET,

      {
        expiresIn: "180d",
      }
    );

    return res.json({
      message:
        "Login successful",

      token,

      sessionId,

      user,
    });
  } catch (err) {
    console.error(
      "Login Error:",
      err
    );

    return res.status(401).json({
      message:
        err.message ||
        "Login failed",
    });
  }
};

/* ======================================================
   GOOGLE AUTH
====================================================== */

export const googleAuth =
  passport.authenticate(
    "google",
    {
      scope: [
        "profile",
        "email",
      ],

      session: false,
    }
  );

/* ======================================================
   GOOGLE CALLBACK
====================================================== */

export const googleCallback = [
  passport.authenticate(
    "google",
    {
      failureRedirect:
        `${CLIENT_URL}/login`,

      session: false,
    }
  ),

  async (req, res) => {
    try {
      const user =
        await handleGoogleAuth(
          req.user
        );

      /* =========================
         CREATE SESSION
      ========================= */

      const sessionId =
        await createSession(
          user,
          req
        );

      /* =========================
         USER ACTIVITY
      ========================= */

      await insertUserActivity(
        user.id,
        "Logged In (Google)"
      );

      /* =========================
         JWT TOKEN
      ========================= */

      const token = jwt.sign(
        {
          id: user.id,

          email: user.email,

          is_admin:
            user.is_admin,

          sessionId,
        },

        JWT_SECRET,

        {
          expiresIn: "180d",
        }
      );

      /* =========================
         REDIRECT
      ========================= */

      return res.redirect(
        `${CLIENT_URL}/auth-success?token=${token}&sessionId=${sessionId}`
      );
    } catch (err) {
      console.error(
        "Google Auth Error:",
        err
      );

      return res.redirect(
        `${CLIENT_URL}/login`
      );
    }
  },
];