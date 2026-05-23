import express from "express";

import {
  handleShiprocketWebhook,
} from "../integrations/shiprocket/shiprocket.webhook.js";

const router = express.Router();

/* =====================================================
   🚚 SHIPROCKET WEBHOOK
===================================================== */

router.post(
  "/shiprocket",
  handleShiprocketWebhook
);

export default router;