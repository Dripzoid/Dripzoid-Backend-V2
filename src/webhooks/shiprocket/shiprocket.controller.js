import {
  processShiprocketWebhook,
} from "./shiprocket.service.js";

export async function handleShiprocketWebhook(
  req,
  res
) {
  try {
    const result =
      await processShiprocketWebhook(req.body);

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    console.error(
      "Shiprocket webhook error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
