import express from "express";

import {
  register,
  login,
  googleAuth,
  googleCallback,
  getMe,
  logout,
  resetPassword,
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

export default router;
