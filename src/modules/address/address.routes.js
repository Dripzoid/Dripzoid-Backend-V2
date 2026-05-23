import express from "express";

import { authenticateToken as authMiddleware } from "../../middlewares/auth.middleware.js";

import {
  addAddress,
  editAddress,
  getAllAddresses,
  getUserDefaultAddress,
  removeAddress,
} from "./address.controller.js";

const router =
  express.Router();

router.get(
  "/",
  authMiddleware,
  getAllAddresses
);

router.post(
  "/",
  authMiddleware,
  addAddress
);

router.put(
  "/:id",
  authMiddleware,
  editAddress
);

router.delete(
  "/:id",
  authMiddleware,
  removeAddress
);

router.get(
  "/default",
  authMiddleware,
  getUserDefaultAddress
);

export default router;