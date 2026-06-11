import prisma from "../../lib/prisma.js";

import { triggerAutomationEvent } from "../../integrations/automation/automation.service.js";

import { EVENT_TYPES } from "../../config/eventTypes.js";

export async function queueOrderCreatedEvent({
  order,
  user,
}) {
  const dbUser = await prisma.user.findUnique({
  where: {
    id: user.id,
  },
  select: {
    id: true,
    name: true,
    email: true,
  },
});
  const payload = {
    customer_name: dbUser?.name,
    email: dbUser?.email,

    user_id: dbUser?.id,

    order_id: order?.orderId,
    order_number: order?.orderNumber,

    order_date: new Date().toISOString(),

    order_total: order?.totalAmount,

    order_url: `${process.env.CLIENT_URL}/order-details/${order?.orderId}`,

    shipment_id:
      order?.shipmentId || null,

    shiprocket_order_id:
      order?.shiprocketOrderId || null,

    delivery_date:
      order?.deliveryDate || null,
  };

  try {
    console.log(
      "🚀 Triggering ORDER_CREATED automation..."
    );

    console.log(
      "📦 Event Payload:",
      JSON.stringify(payload, null, 2)
    );

    const response =
      await triggerAutomationEvent(
        EVENT_TYPES.ORDER_CREATED,
        payload
      );

    console.log(
      "✅ ORDER_CREATED automation triggered successfully"
    );

    console.log(
      "📨 Automation Response:",
      {
        status: response?.status,
        data: response?.data,
      }
    );
  } catch (error) {
    console.error(
      "\n❌ ORDER_CREATED AUTOMATION FAILED"
    );

    console.error(
      "Event Type:",
      EVENT_TYPES.ORDER_CREATED
    );

    console.error(
      "Payload:",
      JSON.stringify(payload, null, 2)
    );

    console.error(
      "Message:",
      error?.message
    );

    console.error(
      "Status:",
      error?.response?.status
    );

    console.error(
      "Status Text:",
      error?.response?.statusText
    );

    console.error(
      "Response Data:",
      JSON.stringify(
        error?.response?.data,
        null,
        2
      )
    );

    console.error(
      "Request URL:",
      error?.config?.url
    );

    console.error(
      "Stack:",
      error?.stack
    );

    try {
      const retryTask =
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
              Date.now() +
                5 * 60 * 1000
            ),

            lastError:
              JSON.stringify({
                message:
                  error?.message,
                status:
                  error?.response
                    ?.status,
                response:
                  error?.response
                    ?.data,
              }),
          },
        });

      console.log(
        "🔄 Retry task created:",
        retryTask.id
      );
    } catch (scheduleError) {
      console.error(
        "❌ Failed to create retry task"
      );

      console.error(
        "Message:",
        scheduleError?.message
      );

      console.error(
        "Stack:",
        scheduleError?.stack
      );
    }
  }
}
