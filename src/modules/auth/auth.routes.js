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
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

export default router;