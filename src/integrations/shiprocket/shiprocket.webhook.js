import {
  updateOrderShipmentStatusService,
} from "../../modules/orders/order.service.js";

/* =====================================================
   🚚 HANDLE SHIPROCKET WEBHOOK
===================================================== */

export async function handleShiprocketWebhook(
  req,
  res,
  next
) {

  try {

    /* =========================================
       🔐 VERIFY WEBHOOK SECRET
    ========================================= */

    const secret =
      req.headers["x-api-key"];

    if (
      secret !==
      process.env
        .SHIPROCKET_WEBHOOK_SECRET
    ) {

      console.warn(
        "❌ Invalid Shiprocket webhook secret"
      );

      return res.status(401).json({
        success: false,

        message:
          "Unauthorized webhook",
      });
    }

    /* =========================================
       📩 WEBHOOK PAYLOAD
    ========================================= */

    console.log(
      "📩 Shiprocket Webhook:",
      req.body
    );

    const payload =
      req.body;

    const {
      awb,
      shipment_status,
      current_status,
      order_id,
    } = payload;

    /* =========================================
       🔄 UPDATE ORDER STATUS
    ========================================= */

    await updateOrderShipmentStatusService({
      awbCode: awb,

      shipmentStatus:
        shipment_status,

      currentStatus:
        current_status,

      shiprocketOrderId:
        order_id,
    });

    /* =========================================
       ✅ SUCCESS RESPONSE
    ========================================= */

    return res.status(200).json({
      success: true,
    });

  } catch (error) {

    next(error);
  }
}