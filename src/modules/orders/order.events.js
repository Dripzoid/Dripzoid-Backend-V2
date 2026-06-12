import prisma from "../../lib/prisma.js";

import { triggerAutomationEvent }
  from "../../integrations/automation/automation.service.js";

import { EVENT_TYPES }
  from "../../config/eventTypes.js";

export async function queueOrderCreatedEvent({
  order,
  user,
}) {
  let automationEvent;

  try {
    const dbUser =
      await prisma.user.findUnique({
        where: {
          id: user.id,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

    if (!dbUser) {
      throw new Error(
        `User not found: ${user.id}`
      );
    }

    const payload = {
      customer_name:
        dbUser.name || "Customer",

      email:
        dbUser.email,

      user_id:
        dbUser.id,

      order_id:
        order?.orderId,

      order_number:
        order?.orderNumber,

      order_date:
        new Date().toISOString(),

      order_total:
        order?.totalAmount,

      order_url:
        `${process.env.CLIENT_URL}/order-details/${order?.orderId}`,

      shipment_id:
        order?.shipmentId || null,

      shiprocket_order_id:
        order?.shiprocketOrderId || null,

      delivery_date:
        order?.deliveryDate || null,
    };

    automationEvent =
      await prisma.automationEvent.create({
        data: {
          eventType:
            EVENT_TYPES.ORDER_CREATED,

          payload,

          source:
            "dripzoid-backend",

          status:
            "pending",
        },
      });

    console.log(
      "🚀 Triggering ORDER_CREATED automation..."
    );

    console.log(
      "📦 Event Payload:",
      JSON.stringify(payload, null, 2)
    );

    await triggerAutomationEvent(
      EVENT_TYPES.ORDER_CREATED,
      {
        automationEventId:
          automationEvent.id,

        ...payload,
      }
    );

    console.log(
      "✅ ORDER_CREATED automation triggered",
      automationEvent.id
    );

    return true;
  } catch (error) {
    console.error(
      "\n❌ ORDER_CREATED AUTOMATION FAILED"
    );

    console.error(
      "Event Type:",
      EVENT_TYPES.ORDER_CREATED
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
      "Response Data:",
      JSON.stringify(
        error?.response?.data,
        null,
        2
      )
    );

    if (automationEvent) {
      try {
        await prisma.automationEvent.update({
          where: {
            id: automationEvent.id,
          },
          data: {
            retryCount: {
              increment: 1,
            },

            lastError:
              error?.response?.data
                ? JSON.stringify(
                    error.response.data
                  )
                : error.message,
          },
        });
      } catch (updateError) {
        console.error(
          "Failed to update automation event:",
          updateError.message
        );
      }
    }

    return false;
  }
}
