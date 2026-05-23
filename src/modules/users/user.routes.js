import express from "express";

import {
  getUsers,
  getUser,
  updateUserController,
  deleteUserController,
} from "./user.controller.js";

import {
  authenticateToken,
} from "../../middlewares/auth.middleware.js";

const router =
  express.Router();

/* =====================================================
   📦 GET ALL USERS
===================================================== */

router.get(
  "/",
  authenticateToken,
  getUsers
);

/* =====================================================
   📦 GET SINGLE USER
===================================================== */

router.get(
  "/:id",
  authenticateToken,
  getUser
);

/* =====================================================
   ✏️ UPDATE USER
===================================================== */

router.put(
  "/:id",
  authenticateToken,
  updateUserController
);

/* =====================================================
   ❌ DELETE USER
===================================================== */

router.delete(
  "/:id",
  authenticateToken,
  deleteUserController
);

export default router;