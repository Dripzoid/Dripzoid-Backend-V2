import { EVENT_TYPES } from "../../config/eventTypes.js";

import {
  triggerAutomationEvent,
} from "./automation.service.js";

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

    return false;
  }
}

export async function queueOrderPackedEvent(
  payload
) {
  await queueEvent(
    EVENT_TYPES.ORDER_PACKED,
    payload
  );
}

export async function queueOrderShippedEvent(
  payload
) {
  await queueEvent(
    EVENT_TYPES.ORDER_SHIPPED,
    payload
  );
}

export async function queueOrderOutForDeliveryEvent(
  payload
) {
  await queueEvent(
    EVENT_TYPES.ORDER_OUT_FOR_DELIVERY,
    payload
  );
}

export async function queueOrderDeliveredEvent(
  payload
) {
  await queueEvent(
    EVENT_TYPES.ORDER_DELIVERED,
    payload
  );
}

export async function queueOrderCancelledEvent(
  payload
) {
  await queueEvent(
    EVENT_TYPES.ORDER_CANCELLED,
    payload
  );
}

export async function queueReturnPickupScheduledEvent(
  payload
) {
  await queueEvent(
    EVENT_TYPES.RETURN_PICKUP_SCHEDULED,
    payload
  );
}

export async function queueReturnReceivedEvent(
  payload
) {
  await queueEvent(
    EVENT_TYPES.RETURN_RECEIVED,
    payload
  );
}

export async function queueOrderReturnedEvent(
  payload
) {
  await queueEvent(
    EVENT_TYPES.ORDER_RETURNED,
    payload
  );
}
