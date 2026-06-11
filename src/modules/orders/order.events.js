import prisma from "../../config/prisma.js";

import { triggerAutomationEvent } from "../../integrations/automation/automation.service.js";

import { EVENT_TYPES } from "../../config/eventTypes.js";

export async function queueOrderCreatedEvent({
  order,
  user,
}) {
  const payload = {
    customer_name: user.name,
    email: user.email,

    user_id: user.id,

    order_id: order.orderId,
    order_number: order.orderNumber,

    order_date: new Date().toISOString(),

    order_total: order.totalAmount,

    order_url: `${process.env.FRONTEND_URL}/orders/${order.orderId}`,

    shipment_id: order.shipmentId || null,
    shiprocket_order_id:
      order.shiprocketOrderId || null,

    delivery_date:
      order.deliveryDate || null,
  };

  try {
    await triggerAutomationEvent(
      EVENT_TYPES.ORDER_CREATED,
      payload
    );
  } catch (error) {
    console.error(
      "Automation ORDER_CREATED failed:",
      error.message
    );

    try {
      await prisma.scheduledTask.create({
        data: {
          taskType:
            "RETRY_AUTOMATION_EVENT",

          payload: {
            eventType:
              EVENT_TYPES.ORDER_CREATED,
            payload,
          },

          executeAt: new Date(
            Date.now() + 5 * 60 * 1000
          ),

          lastError: error.message,
        },
      });
    } catch (scheduleError) {
      console.error(
        "Failed to create retry task:",
        scheduleError.message
      );
    }
  }
}
