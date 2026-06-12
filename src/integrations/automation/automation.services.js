import prisma from "../../lib/prisma.js";

import { EVENT_TYPES } from "../../config/eventTypes.js";

import {
  triggerAutomationEvent,
} from "./automation.service.js";

async function buildOrderPayload(orderId) {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      user: true,
      shipment: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  return {
    order,
    payload: {
      customer_name:
        order.user?.name || "Customer",

      email:
        order.user?.email,

      user_id:
        order.userId,

      order_id:
        order.id,

      order_number:
        order.orderNumber,

      order_url:
        `${process.env.CLIENT_URL}/orders/${order.id}`,

      courier_name:
        order.shipment?.courierName,

      awb_number:
        order.shipment?.awbCode,

      tracking_url:
        order.shipment?.awbCode
          ? `https://shiprocket.co/tracking/${order.shipment.awbCode}`
          : null,

      delivery_date:
        order.deliveryDate,

      estimated_delivery:
        order.deliveryDate,

      year:
        new Date().getFullYear(),
    },
  };
}


async function queueEvent(
  eventType,
  payload
) {
  try {
    await triggerAutomationEvent(
      eventType,
      payload
    );

    console.log(
      `✅ ${eventType} queued`
    );

    return true;
  } catch (error) {
    console.error(
      `❌ ${eventType} failed`,
      error?.response?.data ||
        error.message
    );

    try {
      await prisma.scheduledEvent.create({
        data: {
          eventType,

          payload,

          status: "PENDING",

          retryCount: 0,

          nextRunAt: new Date(
            Date.now() +
              5 * 60 * 1000
          ), // retry after 5 min

          lastError:
            error?.response?.data
              ? JSON.stringify(
                  error.response.data
                )
              : error.message,
        },
      });

      console.log(
        `📅 ${eventType} added to retry queue`
      );
    } catch (dbError) {
      console.error(
        `❌ Failed to create ScheduledEvent`,
        dbError.message
      );
    }

    return false;
  }
}

export async function queueOrderPackedEvent(
  orderId
) {
  const { payload } =
    await buildOrderPayload(
      orderId
    );

  await queueEvent(
    EVENT_TYPES.ORDER_PACKED,
    {
      ...payload,

      packed_date:
        new Date().toLocaleDateString(
          "en-IN"
        ),
    }
  );
}
export async function queueOrderShippedEvent(
  orderId
) {
  const { payload } =
    await buildOrderPayload(
      orderId
    );

  await queueEvent(
    EVENT_TYPES.ORDER_SHIPPED,
    payload
  );
}
export async function queueOrderOutForDeliveryEvent(
  orderId
) {
  const { payload } =
    await buildOrderPayload(
      orderId
    );

  await queueEvent(
    EVENT_TYPES.ORDER_OUT_FOR_DELIVERY,
    payload
  );
}
export async function queueOrderDeliveredEvent(
  orderId
) {
  const { payload } =
    await buildOrderPayload(
      orderId
    );

  await queueEvent(
    EVENT_TYPES.ORDER_DELIVERED,
    {
      ...payload,

      delivery_date:
        new Date().toLocaleDateString(
          "en-IN"
        ),
    }
  );
}
export async function queueOrderCancelledEvent(
  orderId
) {
  const { payload } =
    await buildOrderPayload(
      orderId
    );

  await queueEvent(
    EVENT_TYPES.ORDER_CANCELLED,
    payload
  );
}
export async function queueReturnPickupScheduledEvent({
  orderId,
  returnId,
  pickupDate,
  pickupAddress,
}) {
  const { payload } =
    await buildOrderPayload(
      orderId
    );

  await queueEvent(
    EVENT_TYPES.RETURN_PICKUP_SCHEDULED,
    {
      ...payload,

      return_id:
        returnId,

      pickup_date:
        pickupDate,

      pickup_address:
        pickupAddress,
    }
  );
}
export async function queueReturnReceivedEvent({
  orderId,
  returnId,
  refundAmount,
}) {
  const { payload } =
    await buildOrderPayload(
      orderId
    );

  await queueEvent(
    EVENT_TYPES.RETURN_RECEIVED,
    {
      ...payload,

      return_id:
        returnId,

      refund_amount:
        refundAmount,

      received_date:
        new Date().toLocaleDateString(
          "en-IN"
        ),
    }
  );
}
export async function queueOrderReturnedEvent({
  orderId,
  returnId,
  refundAmount,
}) {
  const { payload } =
    await buildOrderPayload(
      orderId
    );

  await queueEvent(
    EVENT_TYPES.ORDER_RETURNED,
    {
      ...payload,

      return_id:
        returnId,

      refund_amount:
        refundAmount,
    }
  );
}
