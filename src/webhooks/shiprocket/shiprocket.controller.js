// src/webhooks/shiprocket/shiprocket.controller.js

import {
  processShiprocketWebhook,
} from "./shiprocket.service.js";

export async function handleShiprocketWebhook(
  req,
  res
) {
  try {
    const webhookKey =
      req.headers["x-api-key"];

    if (
      webhookKey !==
      process.env.SHIPROCKET_WEBHOOK_SECRET
    ) {
      return res.sendStatus(401);
    }

    await processShiprocketWebhook(
      req.body
    );

    return res.sendStatus(200);
  } catch (error) {
    console.error(
      "Shiprocket Webhook Error:",
      error
    );

    return res.sendStatus(200);
  }
}
