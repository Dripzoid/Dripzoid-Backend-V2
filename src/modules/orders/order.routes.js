import express from "express";
import { placeOrder } from "./order.controller.js";
import { authenticateToken } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/place-order", authenticateToken, placeOrder);

export default router;