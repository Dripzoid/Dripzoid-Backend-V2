// shiprocket.controller.js

import {
  processShiprocketWebhook,
} from "./shiprocket.service.js";

export async function handleShiprocketWebhook(
  req,
  res
) {
  try {
    await processShiprocketWebhook(
      req.body
    );
  } catch (error) {
    console.error(
      "Shiprocket Webhook Error:",
      error
    );
  }

  return res.sendStatus(200);
}
