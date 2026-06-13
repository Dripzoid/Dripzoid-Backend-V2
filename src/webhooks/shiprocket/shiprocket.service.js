// src/webhooks/shiprocket/shiprocket.service.js

import prisma from "../../lib/prisma.js";

import {
  updateShipmentStatus,
  isOrderTerminalStatus,
} from "../../integrations/shiprocket/shiprocket.service.js";

export async function processShiprocketWebhook(payload) {
  if (!payload) {
    throw new Error("Webhook payload is required");
  }

  const shipmentRefId =
    payload?.shipment_id ||
    payload?.shipmentId ||
    payload?.shipmentID;

  const shiprocketOrderId =
    payload?.sr_order_id ||
    payload?.srOrderId ||
    payload?.shiprocket_order_id ||
    payload?.shiprocketOrderId ||
    payload?.order_id ||
    payload?.orderId;

  const awbCode =
    payload?.awb ||
    payload?.awb_code ||
    payload?.awbCode;

  const rawStatus =
    payload?.status ||
    payload?.current_status ||
    payload?.shipment_status ||
    payload?.event_status ||
    payload?.tracking_status;

  // Store webhook for audit/debugging
  const webhookEvent =
    await prisma.shipmentWebhookEvent.create({
      data: {
        shipmentId: shipmentRefId
          ? String(shipmentRefId)
          : null,

        shiprocketOrderId: shiprocketOrderId
          ? String(shiprocketOrderId)
          : null,

        status: rawStatus
          ? String(rawStatus)
          : null,

        payload,
      },
    });

  let shipment = null;

  // 1. Lookup by Shiprocket Shipment ID
  if (shipmentRefId) {
    shipment =
      await prisma.shipment.findUnique({
        where: {
          shipmentId: String(shipmentRefId),
        },
        include: {
          order: true,
        },
      });
  }

  // 2. Lookup by Shiprocket Order ID
  if (!shipment && shiprocketOrderId) {
    shipment =
      await prisma.shipment.findFirst({
        where: {
          shiprocketOrderId: String(
            shiprocketOrderId
          ),
        },
        include: {
          order: true,
        },
      });
  }

  // 3. Fallback Lookup by AWB
  if (!shipment && awbCode) {
    shipment =
      await prisma.shipment.findFirst({
        where: {
          awbCode: String(awbCode),
        },
        include: {
          order: true,
        },
      });
  }

  if (!shipment) {
    console.error(
      "Webhook shipment not found",
      {
        shipmentRefId,
        shiprocketOrderId,
        awbCode,
      }
    );

    return {
      success: false,
      reason: "Shipment not found",
      webhookEventId: webhookEvent.id,
    };
  }

  const order =
    shipment.order ||
    (await prisma.order.findUnique({
      where: {
        id: shipment.orderId,
      },
    }));

  if (
    order &&
    isOrderTerminalStatus(order.status)
  ) {
    return {
      success: true,
      skipped: true,
      reason: `Order already in terminal state: ${order.status}`,
      webhookEventId: webhookEvent.id,
    };
  }

  const updatedShipment =
    await updateShipmentStatus({
      shipmentDbId: shipment.id,

      shipmentStatus: rawStatus,

      activity:
        payload?.activity ||
        payload?.note ||
        payload?.details ||
        rawStatus,

      location:
        payload?.location ||
        payload?.city ||
        payload?.hub_name,

      scanTimestamp:
        payload?.scan_timestamp ||
        payload?.scanTimestamp ||
        payload?.current_timestamp ||
        payload?.date,

      courierId:
        payload?.courier_company_id ||
        payload?.courier_id,

      courierName:
        payload?.courier_name,

      awbCode,

      pickupTokenNumber:
        payload?.pickup_token_number,
    });

  return {
    success: true,
    shipment: updatedShipment,
    orderId: shipment.orderId,
    webhookEventId: webhookEvent.id,
  };
}
