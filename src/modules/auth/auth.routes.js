import express from "express";

import {
  register,
  login,
  googleAuth,
  googleCallback,
  googleMobile,
  getMe,
  logout,
  resetPassword,
  checkEmail,
} from "./auth.controller.js";

import { protect } from "../../middlewares/auth.middleware.js";

const router = express.Router();

/* =========================
   AUTH
========================= */

router.post(
  "/register",
  register
);

router.post(
  "/login",
  login
);

/* =========================
   GOOGLE AUTH
========================= */

router.get(
  "/google",
  googleAuth
);

router.get(
  "/google/callback",
  googleCallback
);

/* =========================
   CURRENT USER
========================= */

router.get(
  "/me",
  protect,
  getMe
);

router.post(
  "/check-email",
  checkEmail
);

/* =========================
   RESET PASSWORD
========================= */

router.post(
  "/reset-password",
  resetPassword
);

/* =========================
   LOGOUT
========================= */

router.post(
  "/logout",
  logout
);

router.post(
  "/google/mobile",
  googleMobile
);

export default router;
