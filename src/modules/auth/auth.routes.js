import express from "express";

import {
  register,
  login,
  googleAuth,
  googleCallback,
  getMe,
  logout,
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
   LOGOUT
========================= */

router.post(
  "/logout",
  logout
);

export default router;
