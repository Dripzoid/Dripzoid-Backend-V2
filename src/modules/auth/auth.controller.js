import jwt from "jsonwebtoken";
import passport from "passport";

import prisma from "../../lib/prisma.js";

import {
  getDevice,
  getIP,
} from "../../utils/device.js";

import {
  insertUserActivity,
} from "../../utils/activity.js";

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

async function createSession(
  user,
  req
) {
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
   GENERATE JWT
====================================================== */

function generateToken(
  user,
  sessionId
) {
  return jwt.sign(
    {
      id: user.id,

      email: user.email,

      isAdmin:
        user.isAdmin,

      sessionId,
    },

    JWT_SECRET,

    {
      expiresIn: "180d",
    }
  );
}

/* ======================================================
   SET AUTH COOKIE
====================================================== */

function setAuthCookie(
  res,
  token
) {
  res.cookie("token", token, {
    httpOnly: true,

    secure:
      process.env.NODE_ENV ===
      "production",

    sameSite:
      process.env.NODE_ENV ===
      "production"
        ? "None"
        : "Lax",

    maxAge:
      180 *
      24 *
      60 *
      60 *
      1000,
  });
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
        success: false,

        message:
          "Email & password required",
      });
    }

    email = email
      .toLowerCase()
      .trim();

    /* =========================
       CREATE USER
    ========================= */

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
      await createSession(
        user,
        req
      );

    /* =========================
       USER ACTIVITY
    ========================= */

    await insertUserActivity(
      user.id,
      "Registered & Logged In"
    );

    /* =========================
       GENERATE TOKEN
    ========================= */

    const token =
      generateToken(
        user,
        sessionId
      );

    /* =========================
       SET COOKIE
    ========================= */

    setAuthCookie(
      res,
      token
    );

    return res.status(201).json({
      success: true,

      message:
        "User registered successfully",

      sessionId,

      user,
    });
  } catch (err) {
    console.error(
      "Register Error:",
      err
    );

    return res.status(400).json({
      success: false,

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
    let {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,

        message:
          "Email & password required",
      });
    }

    email = email
      .toLowerCase()
      .trim();

    /* =========================
       LOGIN USER
    ========================= */

    const user =
      await loginUser({
        email,
        password,
      });

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
      "Logged In"
    );

    /* =========================
       GENERATE TOKEN
    ========================= */

    const token =
      generateToken(
        user,
        sessionId
      );

    /* =========================
       SET COOKIE
    ========================= */

    setAuthCookie(
      res,
      token
    );

    return res.json({
      success: true,

      message:
        "Login successful",

      sessionId,

      user,
    });
  } catch (err) {
    console.error(
      "Login Error:",
      err
    );

    return res.status(401).json({
      success: false,

      message:
        err.message ||
        "Login failed",
    });
  }
};

/* ======================================================
   GOOGLE AUTH
====================================================== */

export const googleAuth = (
  req,
  res,
  next
) => {
  const returnTo =
    req.query.returnTo || "/";

  passport.authenticate(
    "google",
    {
      scope: [
        "profile",
        "email",
      ],

      session: false,

      state: encodeURIComponent(
        returnTo
      ),
    }
  )(req, res, next);
};

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
      /* =========================
         GOOGLE USER
      ========================= */

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
         GENERATE TOKEN
      ========================= */

      const token =
        generateToken(
          user,
          sessionId
        );

      /* =========================
         SET COOKIE
      ========================= */

      setAuthCookie(
        res,
        token
      );

      /* =========================
         GET RETURN URL
      ========================= */

      const returnTo =
        req.query.state
          ? decodeURIComponent(
              req.query.state
            )
          : "/";

      /* =========================
         REDIRECT USER
      ========================= */

      return res.redirect(
        `${CLIENT_URL}${returnTo}`
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

/* ======================================================
   GET CURRENT USER
====================================================== */

export const getMe = async (
  req,
  res
) => {
  try {
    const user =
      await prisma.user.findUnique({
        where: {
          id: req.user.id,
        },

        select: {
          id: true,

          name: true,

          email: true,

          phone: true,

          gender: true,

          dob: true,

          isAdmin: true,

          createdAt: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,

        message:
          "User not found",
      });
    }

    return res.json({
      success: true,

      user,
    });
  } catch (err) {
    console.error(
      "Get Me Error:",
      err
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch user",
    });
  }
};

/* ======================================================
   LOGOUT
====================================================== */

export const logout = async (
  req,
  res
) => {
  try {
    res.clearCookie("token");

    return res.json({
      success: true,

      message:
        "Logged out successfully",
    });
  } catch (err) {
    console.error(
      "Logout Error:",
      err
    );

    return res.status(500).json({
      success: false,

      message:
        "Logout failed",
    });
  }
};
