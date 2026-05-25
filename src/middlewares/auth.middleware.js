import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

import prisma from "../lib/prisma.js";

// 🔐 Main Auth Middleware
export function authenticateToken(req, res, next) {
  try {
    let token = null;

    // Authorization header
    const authHeader =
      req.headers["authorization"] ||
      req.headers["Authorization"];

    if (
      authHeader &&
      authHeader.toLowerCase().startsWith("bearer ")
    ) {
      token = authHeader.split(" ")[1];
    }

    // Fallback to cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    req.user = payload;
    req.token = token;
    req.sessionId =
      payload?.sessionId ||
      req.cookies?.sessionId ||
      null;

    next();
  } catch (err) {
    console.error("authenticateToken error:", err);

    if (err.name === "TokenExpiredError") {
      return res.status(403).json({
        message: "Token expired",
      });
    }

    return res.status(403).json({
      message: "Invalid token",
    });
  }
}

/* ======================================================
   PROTECT ROUTE
====================================================== */

export const protect = async (
  req,
  res,
  next
) => {
  try {
    let token = null;

    /* =========================
       TOKEN FROM COOKIE
    ========================= */

    if (req.cookies?.token) {
      token = req.cookies.token;
    }

    /* =========================
       TOKEN FROM HEADER
    ========================= */

    else if (
      req.headers.authorization?.startsWith(
        "Bearer "
      )
    ) {
      token =
        req.headers.authorization.split(
          " "
        )[1];
    }

    /* =========================
       NO TOKEN
    ========================= */

    if (!token) {
      return res.status(401).json({
        success: false,

        message:
          "Unauthorized",
      });
    }

    /* =========================
       VERIFY TOKEN
    ========================= */

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    /* =========================
       FIND USER
    ========================= */

    const user =
      await prisma.user.findUnique({
        where: {
          id: decoded.id,
        },
      });

    if (!user) {
      return res.status(401).json({
        success: false,

        message:
          "User not found",
      });
    }

    /* =========================
       ATTACH USER
    ========================= */

    req.user = user;

    next();
  } catch (err) {
    console.error(
      "Protect Middleware Error:",
      err
    );

    return res.status(401).json({
      success: false,

      message:
        "Invalid token",
    });
  }
};

/* ======================================================
   ADMIN ONLY
====================================================== */

export const adminOnly = (
  req,
  res,
  next
) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      success: false,

      message:
        "Admin access required",
    });
  }

  next();
};
