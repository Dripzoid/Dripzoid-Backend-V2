import express from "express";

import {
  handleShiprocketWebhook,
} from "./shiprocket.controller.js";

const router = express.Router();

router.post(
  "/shiprocket",
  handleShiprocketWebhook
);

export default router;
