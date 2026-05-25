import express from "express";
import {
  register,
  login,
  googleAuth,
  googleCallback
} from "./auth.controller.js";

const router = express.Router();

// -------------------- AUTH --------------------
router.post("/register", register);
router.post("/login", login);

// -------------------- GOOGLE OAUTH --------------------
router.get("/auth/google", googleAuth);
router.get("/auth/google/callback", googleCallback);

export default router;
