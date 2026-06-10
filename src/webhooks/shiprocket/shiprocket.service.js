// src/webhooks/shiprocket/shiprocket.service.js

import prisma from "../../lib/prisma.js";

import {
  updateOrderShipmentStatusService,
} from "../../modules/order/order.service.js";

const STATUS_MAPPING = {
  "PICKED UP": "Packed",

  SHIPPED: "Shipped",

  "IN TRANSIT": "In Transit",

  "OUT FOR DELIVERY":
    "Out For Delivery",

  DELIVERED: "Delivered",

  "RTO INITIATED":
    "RTO Initiated",

  "RTO IN TRANSIT":
    "RTO In Transit",

  "RTO DELIVERED":
    "RTO Delivered",

  CANCELLED: "Cancelled",
};

export async function processShiprocketWebhook(
  payload
) {
  console.log(
    "Shiprocket Webhook:",
    JSON.stringify(
      payload,
      null,
      2
    )
  );

  const {
    order_id,
    shipment_status,
    awb,
    courier_name,
  } = payload;

  const order =
    await prisma.order.findFirst({
      where: {
        shiprocketOrderId:
          String(order_id),
      },
    });

  if (!order) {
    throw new Error(
      `Order not found for Shiprocket Order ID: ${order_id}`
    );
  }

  const mappedStatus =
    STATUS_MAPPING[
      shipment_status
    ] || shipment_status;

  const updatedOrder =
    await updateOrderShipmentStatusService({
      orderId: order.id,

      shipmentStatus:
        mappedStatus,

      awbCode:
        awb ||
        order.awbCode,

      courierName:
        courier_name ||
        order.courierName,
    });

  return {
    success: true,

    orderId:
      updatedOrder.id,

    shipmentStatus:
      updatedOrder.shipmentStatus,
  };
}
