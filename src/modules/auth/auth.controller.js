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
    handleGoogleMobile,
    resetUserPassword,
    checkEmailExists,
} from "./auth.service.js";

const JWT_SECRET =
  process.env.JWT_SECRET;

const CLIENT_URL =
  process.env.CLIENT_URL;

/* ======================================================
   CHECK EMAIL
====================================================== */

export const checkEmail = async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    email = email.toLowerCase().trim();

    const exists = await checkEmailExists(email);

    return res.json({
      success: true,
      exists,
      available: !exists,
      message: exists
        ? "Email already registered"
        : "Email is available",
    });
  } catch (err) {
    console.error("Check Email Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to check email",
    });
  }
};

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
      expiresIn: "7d",
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
      7 *
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
  const defaultClient = (
    process.env.CLIENT_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://dripzoid-frontend.onrender.com"
      : "http://localhost:3000")
  ).replace(/\/+$/, "");

  const returnTo =
    req.query.returnTo ||
    defaultClient;

  passport.authenticate(
    "google",
    {
      scope: [
        "profile",
        "email",
      ],

      session: false,

      state:
        encodeURIComponent(
          returnTo
        ),
    }
  )(req, res, next);
};

/* ======================================================
   GOOGLE CALLBACK
====================================================== */

export const googleCallback = [
  (req, res, next) => {
    const defaultClient = (
      process.env.CLIENT_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://dripzoid-frontend.onrender.com"
        : "http://localhost:3000")
    ).replace(/\/+$/, "");

    passport.authenticate(
      "google",
      {
        failureRedirect:
          `${defaultClient}/login?error=google_auth_failed`,
        session: false,
      }
    )(req, res, next);
  },

  async (req, res) => {
    const defaultClient = (
      process.env.CLIENT_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://dripzoid-frontend.onrender.com"
        : "http://localhost:3000")
    ).replace(/\/+$/, "");

    try {
      if (!req.user) {
        throw new Error("No Google profile received");
      }

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
          : defaultClient;

      console.log(
        "Google Return To:",
        returnTo
      );

      /* =========================
         SECURITY CHECK
      ========================= */

      const allowedOrigins = [
        "https://dripzoid.yuvatejasainadh.me",
        "https://dripzoidv2.vercel.app",
        "https://dripzoid-frontend.onrender.com",
        "https://dripzoid.com",
        "https://www.dripzoid.com",
        "https://askdrip-frontend.onrender.com",
        "https://ask.dripzoid.com",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
      ];

      if (process.env.CLIENT_URL) {
        allowedOrigins.push(
          process.env.CLIENT_URL.replace(/\/+$/, "")
        );
      }

      const isAllowed =
        allowedOrigins.some(
          (origin) =>
            returnTo.startsWith(
              origin
            )
        );

      const targetUrl = isAllowed ? returnTo : defaultClient;

      // Append token so client can authenticate reliably across domains even if cross-site cookies are blocked
      let redirectDestination = targetUrl;
      try {
        const urlObj = new URL(targetUrl);
        urlObj.searchParams.set("token", token);
        redirectDestination = urlObj.toString();
      } catch {
        const separator = targetUrl.includes("?") ? "&" : "?";
        redirectDestination = `${targetUrl}${separator}token=${encodeURIComponent(token)}`;
      }

      return res.redirect(redirectDestination);
    } catch (err) {
      console.error(
        "Google Auth Error:",
        err.message || err
      );

      return res.redirect(
        `${defaultClient}/login?error=${encodeURIComponent("Google authentication failed")}`
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
   RESET PASSWORD
====================================================== */

export const resetPassword = async (
  req,
  res
) => {
  try {
    let {
      email,
      password,
    } = req.body;

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password required",
      });
    }

    email =
      email
        .toLowerCase()
        .trim();

    await resetUserPassword({
      email,
      password,
    });

    return res.json({
      success: true,
      message:
        "Password reset successful",
    });
  } catch (err) {
    console.error(
      "Reset Password Error:",
      err
    );

    return res.status(400).json({
      success: false,
      message:
        err.message ||
        "Password reset failed",
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

export const googleMobile = async (req, res) => {

    try {

        const { idToken } = req.body;

        if (!idToken) {

            return res.status(400).json({
                success: false,
                message: "Google ID token is required",
            });

        }

        const user =
            await handleGoogleMobile(idToken);

        const sessionId =
            await createSession(user, req);

        await insertUserActivity(
            user.id,
            "Logged In (Google Mobile)"
        );

        const token =
            generateToken(user, sessionId);

        return res.json({

            success: true,

            message: "Google login successful",

            token,

            sessionId,

            user,

        });

    } catch (err) {

        console.error(err);

        return res.status(401).json({

            success: false,

            message: err.message,

        });

    }

};
