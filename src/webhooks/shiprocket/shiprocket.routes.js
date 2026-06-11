import express from "express";

import {
  handleShiprocketWebhook,
} from "./shiprocket.controller.js";

const router = express.Router();

router.post(
  "/shipping",
  handleShiprocketWebhook
);

export default router;
