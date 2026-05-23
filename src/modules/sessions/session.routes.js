import express from "express";
import {
  signoutSession,
  logoutAll,
  getSessions,
  revokeSession,
} from "./session.controller.js";

import { authenticateToken } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signout-session", authenticateToken, signoutSession);
router.post("/logout-all", authenticateToken, logoutAll);
router.get("/", authenticateToken, getSessions);
router.delete("/:id", authenticateToken, revokeSession);

export default router;