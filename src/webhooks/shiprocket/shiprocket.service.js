// src/webhooks/shiprocket/shiprocket.service.js

import {
  updateOrderShipmentStatusService,
} from "../../modules/order/order.service.js";

const STATUS_MAPPING = {
  NEW: "PLACED",
  PICKED_UP: "PACKED",
  SHIPPED: "SHIPPED",
  "OUT FOR DELIVERY": "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

export async function processShiprocketWebhook(
  payload
) {
  console.log(
    "Shiprocket Webhook:",
    payload
  );

  const {
    order_id,
    shipment_status,
    awb_code,
    courier_name,
    tracking_url,
  } = payload;

  const mappedStatus =
    STATUS_MAPPING[
      shipment_status
    ];

  if (!mappedStatus) {
    console.log(
      "Unhandled Shiprocket Status:",
      shipment_status
    );

    return {
      success: false,
      message:
        "Unhandled shipment status",
    };
  }

  const updatedOrder =
    await updateOrderShipmentStatusService({
      orderId: order_id, // assuming this is your Dripzoid order id
      shipmentStatus:
        mappedStatus,
      awbCode: awb_code,
      courierName:
        courier_name,
      trackingUrl:
        tracking_url,
    });

  return {
    success: true,
    orderId:
      updatedOrder.id,
    shipmentStatus:
      updatedOrder.shipmentStatus,
  };
}
