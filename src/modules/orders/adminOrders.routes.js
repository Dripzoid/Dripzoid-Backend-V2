import express from "express";

import {
  getAllOrders,
  getOrder,
  updateStatus,
  deleteOrder,
} from "./adminOrders.controller.js";

import { adminAuth } from "../../middlewares/admin.middleware.js";

const router = express.Router();


// 📦 Orders
router.get("/", adminAuth, getAllOrders);
router.get("/:id", adminAuth, getOrder);

// 🔄 Update
router.put("/:id/status", adminAuth, updateStatus);

// ❌ Delete
router.delete("/:id", adminAuth, deleteOrder);

export default router;