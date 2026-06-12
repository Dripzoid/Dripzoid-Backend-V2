// src/services/shipping.service.js
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import {
  SHIPROCKET_STATUS_MAP,
  SHIPMENT_TO_ORDER_STATUS,
} from "./shiprocket.constants.js";
import { cancelOrderService } from "./order.service.js";
import {
  queueOrderPackedEvent,
  queueOrderShippedEvent,
  queueOrderOutForDeliveryEvent,
  queueOrderDeliveredEvent,
  queueOrderCancelledEvent,
  queueOrderReturnedEvent,
} from "../automation/automation.services.js";

/**
 * If your project already exports a shared prisma client,
 * replace this block with that import.
 */
const prisma =
  globalThis.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;
const WAREHOUSE_PINCODE =
  process.env.WAREHOUSE_PINCODE ||
  process.env.SHIPROCKET_PICKUP_PINCODE ||
  "";

const TERMINAL_SHIPMENT_STATUSES = new Set([
  "Delivered",
  "Cancelled",
  "Returned",
  "RTO Delivered",
]);

const SHIPPED_AUTOMATION_STATUSES = new Set(["Shipped", "In Transit"]);
const OUT_FOR_DELIVERY_AUTOMATION_STATUSES = new Set(["Out For Delivery"]);
const DELIVERED_AUTOMATION_STATUSES = new Set(["Delivered"]);
const CANCELLED_AUTOMATION_STATUSES = new Set(["Cancelled"]);
const RETURNED_AUTOMATION_STATUSES = new Set([
  "RTO Initiated",
  "RTO In Transit",
  "RTO Delivered",
  "Return Requested",
  "Return Picked",
  "Return Delivered",
  "Returned",
]);

/* =====================================================
   TOKEN CACHE
===================================================== */

let cachedToken = null;
let tokenExpiry = null;

async function generateToken() {
  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
    throw new Error("SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD missing");
  }

  const response = await axios.post(
    `${BASE_URL}/auth/login`,
    {
      email: SHIPROCKET_EMAIL,
      password: SHIPROCKET_PASSWORD,
    },
    { timeout: 15000 }
  );

  cachedToken = response.data?.token || null;
  tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000;

  if (!cachedToken) {
    throw new Error("Shiprocket token not returned");
  }

  return cachedToken;
}

export async function getShiprocketToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  return generateToken();
}

/* =====================================================
   SHIPROCKET REQUEST WRAPPER
===================================================== */

async function shiprocketRequest({
  method = "GET",
  endpoint,
  data = null,
  params = null,
  retry = true,
}) {
  const token = await getShiprocketToken();

  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data,
      params,
      timeout: 20000,
    });

    return response.data;
  } catch (err) {
    const status = err?.response?.status;

    if (status === 401 && retry) {
      cachedToken = null;
      tokenExpiry = null;

      return shiprocketRequest({
        method,
        endpoint,
        data,
        params,
        retry: false,
      });
    }

    throw err;
  }
}

/* =====================================================
   HELPERS
===================================================== */

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function asString(value) {
  if (value === undefined || value === null) return null;
  return String(value);
}

function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildTrackingEventKey(event) {
  const ts = event?.scanTimestamp
    ? new Date(event.scanTimestamp).toISOString()
    : "";
  return [event?.status || "", event?.activity || "", event?.location || "", ts].join(
    "|"
  );
}

function normalizeShiprocketStatus(rawStatus) {
  if (!rawStatus) return null;

  const normalizedKey = String(rawStatus)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  return SHIPROCKET_STATUS_MAP[normalizedKey] || String(rawStatus).trim();
}

export function isOrderTerminalStatus(status) {
  return ["Cancelled", "RefundInitiated", "RefundProcessed", "Returned"].includes(
    status
  );
}

function isRtoShipmentStatus(status) {
  return ["RTO Initiated", "RTO In Transit", "RTO Delivered"].includes(status);
}

function getShipmentExternalId(shipment) {
  const shipmentId = asString(shipment?.shipmentId);
  if (!shipmentId) {
    throw new Error("Shipment shipmentId is required for AWB generation");
  }
  return shipmentId;
}

function getTrackingId(shipment) {
  const trackingId = asString(shipment?.shiprocketOrderId);
  if (!trackingId) {
    throw new Error("Shipment shiprocketOrderId is required for tracking");
  }
  return trackingId;
}

function buildClientUrl(path) {
  const base = (process.env.CLIENT_URL || "").replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${suffix}` : suffix;
}

function getOrderDetailsUrl(shipment) {
  if (!shipment?.orderId) return null;
  return buildClientUrl(`/order-details/${shipment.orderId}`);
}

function getTrackingUrl(shipment) {
  if (!shipment?.orderId) return null;
  return buildClientUrl(`/track-order/${shipment.orderId}`);
}

function buildOrderAutomationBase(shipment) {
  return {
    customer_name: shipment?.order?.user?.name || null,
    email: shipment?.order?.user?.email || null,
    user_id: shipment?.order?.userId || null,
    order_id: shipment?.orderId || null,
    order_number: shipment?.order?.orderNumber || null,
    order_url: getOrderDetailsUrl(shipment),
  };
}

function shouldFireAutomation(previousStatus, nextStatus, statusesSet) {
  if (!nextStatus) return false;
  if (!statusesSet.has(nextStatus)) return false;
  return !statusesSet.has(previousStatus);
}

async function safeQueueAutomation(queueFn, payload, label) {
  try {
    await queueFn(payload);
  } catch (error) {
    console.error(`❌ ${label} automation failed:`, error?.message || error);
  }
}

function extractShiprocketIds(response = {}) {
  return {
    shiprocketOrderId: asString(
      pickFirst(
        response?.order_id,
        response?.orderId,
        response?.data?.order_id,
        response?.data?.orderId,
        response?.payload?.order_id,
        response?.payload?.orderId,
        response?.response?.data?.order_id,
        response?.response?.data?.orderId
      )
    ),
    shipmentId: asString(
      pickFirst(
        response?.shipment_id,
        response?.shipmentId,
        response?.data?.shipment_id,
        response?.data?.shipmentId,
        response?.payload?.shipment_id,
        response?.payload?.shipmentId,
        response?.response?.data?.shipment_id,
        response?.response?.data?.shipmentId
      )
    ),
    awbCode: asString(
      pickFirst(
        response?.awb_code,
        response?.awbCode,
        response?.data?.awb_code,
        response?.data?.awbCode,
        response?.result?.awb_code,
        response?.result?.awbCode,
        response?.response?.data?.awb_code,
        response?.response?.data?.awbCode
      )
    ),
    pickupTokenNumber: asString(
      pickFirst(
        response?.pickup_token_number,
        response?.pickupTokenNumber,
        response?.data?.pickup_token_number,
        response?.data?.pickupTokenNumber,
        response?.response?.data?.pickup_token_number,
        response?.response?.data?.pickupTokenNumber
      )
    ),
  };
}

function extractAvailableCouriers(response) {
  return (
    response?.data?.available_courier_companies ||
    response?.available_courier_companies ||
    response?.data?.couriers ||
    response?.couriers ||
    []
  );
}

function extractTrackingActivities(response) {
  const candidates = [
    response?.tracking_data?.shipment_track_activities,
    response?.data?.tracking_data?.shipment_track_activities,
    response?.tracking_data?.shipment_track,
    response?.data?.tracking_data?.shipment_track,
    response?.data?.track_data?.shipment_track_activities,
    response?.track_data?.shipment_track_activities,
  ];

  const found = candidates.find((v) => Array.isArray(v));
  if (!found) return [];

  return found
    .flatMap((item) => {
      if (!item) return [];

      if (
        item.activity ||
        item.status ||
        item.location ||
        item.scan_timestamp ||
        item.date
      ) {
        return [item];
      }

      if (Array.isArray(item?.activities)) return item.activities;

      return [];
    })
    .filter(Boolean);
}

function normalizeTrackingEvent(evt) {
  const scanTimestamp = toDateOrNull(
    evt?.scan_timestamp ||
      evt?.scanTimestamp ||
      evt?.date ||
      evt?.created_at ||
      evt?.updated_at ||
      null
  );

  return {
    status: normalizeShiprocketStatus(
      pickFirst(
        evt?.status,
        evt?.current_status,
        evt?.shipment_status,
        evt?.activity_status,
        evt?.sr_status_name
      )
    ),
    activity: asString(
      pickFirst(
        evt?.activity,
        evt?.current_status,
        evt?.note,
        evt?.details,
        evt?.description,
        evt?.activity_description
      )
    ),
    location: asString(
      pickFirst(
        evt?.location,
        evt?.city,
        evt?.hub_name,
        evt?.scanned_location,
        evt?.destination
      )
    ),
    scanTimestamp,
  };
}

function getMutableShipmentStatus(currentStatus, desiredStatus) {
  if (!desiredStatus) return currentStatus || null;
  if (TERMINAL_SHIPMENT_STATUSES.has(currentStatus)) return currentStatus;
  return desiredStatus;
}

function resolveNextOrderStatus(nextShipmentStatus) {
  let nextOrderStatus = SHIPMENT_TO_ORDER_STATUS[nextShipmentStatus] || null;

  if (isRtoShipmentStatus(nextShipmentStatus)) {
    nextOrderStatus = "Cancelled";
  }

  return nextOrderStatus;
}

async function upsertCourierFromShiprocket(courier) {
  const id = toNumber(
    pickFirst(
      courier?.courier_company_id,
      courier?.courier_id,
      courier?.id,
      courier?.courierCompanyId
    )
  );

  if (!id) return null;

  return prisma.courier.upsert({
    where: { id },
    create: {
      id,
      name:
        asString(
          pickFirst(
            courier?.courier_name,
            courier?.name,
            courier?.courierCompanyName
          )
        ) || `Courier ${id}`,
      baseCourierId: toNumber(
        pickFirst(courier?.base_courier_id, courier?.baseCourierId)
      ),
      minWeight: toNumber(pickFirst(courier?.min_weight, courier?.minWeight)),
      mode: toNumber(courier?.mode),
      serviceType: toNumber(
        pickFirst(courier?.service_type, courier?.serviceType)
      ),
      isActive: true,
      realtimeTracking: asString(
        pickFirst(courier?.realtime_tracking, courier?.realtimeTracking)
      ),
      podAvailable: asString(
        pickFirst(courier?.pod_available, courier?.podAvailable)
      ),
      callBeforeDelivery: asString(
        pickFirst(courier?.call_before_delivery, courier?.callBeforeDelivery)
      ),
    },
    update: {
      name:
        asString(
          pickFirst(
            courier?.courier_name,
            courier?.name,
            courier?.courierCompanyName
          )
        ) || `Courier ${id}`,
      baseCourierId: toNumber(
        pickFirst(courier?.base_courier_id, courier?.baseCourierId)
      ),
      minWeight: toNumber(pickFirst(courier?.min_weight, courier?.minWeight)),
      mode: toNumber(courier?.mode),
      serviceType: toNumber(
        pickFirst(courier?.service_type, courier?.serviceType)
      ),
      isActive: true,
      realtimeTracking: asString(
        pickFirst(courier?.realtime_tracking, courier?.realtimeTracking)
      ),
      podAvailable: asString(
        pickFirst(courier?.pod_available, courier?.podAvailable)
      ),
      callBeforeDelivery: asString(
        pickFirst(courier?.call_before_delivery, courier?.callBeforeDelivery)
      ),
    },
  });
}

async function emitOrderEvent(eventName, payload) {
  return { eventName, payload };
}

async function appendTrackingEventWithClient(
  db,
  {
    shipmentDbId,
    status,
    activity = null,
    location = null,
    scanTimestamp = null,
  }
) {
  if (!shipmentDbId) throw new Error("shipmentDbId is required");
  if (!status) throw new Error("status is required");

  const nextEvent = {
    shipmentId: shipmentDbId,
    status,
    activity: activity || status,
    location: location || null,
    scanTimestamp: toDateOrNull(scanTimestamp),
  };

  const existing = await db.shipmentTracking.findMany({
    where: { shipmentId: shipmentDbId },
    select: {
      status: true,
      activity: true,
      location: true,
      scanTimestamp: true,
    },
  });

  const nextKey = buildTrackingEventKey(nextEvent);
  const alreadyExists = existing.some(
    (item) => buildTrackingEventKey(item) === nextKey
  );

  if (alreadyExists) return null;

  return db.shipmentTracking.create({
    data: nextEvent,
  });
}

async function updateShipmentStatusWithClient(
  db,
  {
    shipmentDbId,
    shipmentStatus,
    activity = null,
    location = null,
    scanTimestamp = null,
    courierId = undefined,
    courierName = undefined,
    awbCode = undefined,
    pickupTokenNumber = undefined,
    assignedAt = undefined,
    shiprocketOrderId = undefined,
    shipmentId = undefined,
  }
) {
  if (!shipmentDbId) {
    throw new Error("shipmentDbId is required");
  }

  const shipment = await db.shipment.findUnique({
    where: { id: shipmentDbId },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  const previousShipmentStatus = shipment.shipmentStatus || null;
  const nextShipmentStatus = shipmentStatus
    ? normalizeShiprocketStatus(shipmentStatus)
    : shipment.shipmentStatus;

  const updatedShipment = await db.shipment.update({
    where: { id: shipmentDbId },
    data: {
      shipmentStatus: nextShipmentStatus || undefined,
      courierId: courierId !== undefined ? courierId : undefined,
      courierName: courierName !== undefined ? courierName : undefined,
      awbCode: awbCode !== undefined ? awbCode : undefined,
      pickupTokenNumber:
        pickupTokenNumber !== undefined ? pickupTokenNumber : undefined,
      assignedAt: assignedAt !== undefined ? assignedAt : undefined,
      shiprocketOrderId:
        shiprocketOrderId !== undefined ? shiprocketOrderId : undefined,
      shipmentId: shipmentId !== undefined ? shipmentId : undefined,
    },
  });

  const nextOrderStatus = resolveNextOrderStatus(nextShipmentStatus);

  if (nextOrderStatus && shipment.orderId) {
    await db.order.update({
      where: { id: shipment.orderId },
      data: { status: nextOrderStatus },
    });
  }

  if (nextShipmentStatus || activity || location || scanTimestamp) {
    await appendTrackingEventWithClient(db, {
      shipmentDbId,
      status: nextShipmentStatus || "Unknown",
      activity: activity || nextShipmentStatus || "Tracking update",
      location,
      scanTimestamp,
    });
  }

  await emitOrderEvent("shipment.updated", {
    shipmentDbId,
    orderId: shipment.orderId,
    shipmentStatus: nextShipmentStatus,
  });

  return {
    shipment: updatedShipment,
    previousShipmentStatus,
    nextShipmentStatus,
  };
}

function normalizeDeliveredDate(scanTimestamp, fallback = new Date().toISOString()) {
  if (!scanTimestamp) return fallback;
  if (scanTimestamp instanceof Date) return scanTimestamp.toISOString();
  return String(scanTimestamp);
}

async function triggerShipmentAutomations({
  shipment,
  previousShipmentStatus,
  nextShipmentStatus,
  awbCode = null,
  courierName = null,
  scanTimestamp = null,
  payload = {},
}) {
  if (!shipment || previousShipmentStatus === nextShipmentStatus) return;

  const basePayload = buildOrderAutomationBase(shipment);
  const trackingUrl = getTrackingUrl(shipment);

  if (
    shouldFireAutomation(
      previousShipmentStatus,
      nextShipmentStatus,
      SHIPPED_AUTOMATION_STATUSES
    )
  ) {
    await safeQueueAutomation(
      queueOrderShippedEvent,
      {
        ...basePayload,
        courier_name: courierName || shipment.courierName || null,
        awb_number: awbCode || shipment.awbCode || null,
        tracking_url: trackingUrl,
        estimated_delivery: pickFirst(
          payload?.estimated_delivery,
          payload?.estimatedDelivery,
          payload?.etd,
          payload?.estimated_delivery_date
        ),
      },
      "ORDER_SHIPPED"
    );
  }

  if (
    shouldFireAutomation(
      previousShipmentStatus,
      nextShipmentStatus,
      OUT_FOR_DELIVERY_AUTOMATION_STATUSES
    )
  ) {
    await safeQueueAutomation(
      queueOrderOutForDeliveryEvent,
      {
        ...basePayload,
        courier_name: courierName || shipment.courierName || null,
        awb_number: awbCode || shipment.awbCode || null,
        delivery_date: normalizeDeliveredDate(
          pickFirst(scanTimestamp, payload?.delivery_date)
        ),
        tracking_url: trackingUrl,
      },
      "ORDER_OUT_FOR_DELIVERY"
    );
  }

  if (
    shouldFireAutomation(
      previousShipmentStatus,
      nextShipmentStatus,
      DELIVERED_AUTOMATION_STATUSES
    )
  ) {
    await safeQueueAutomation(
      queueOrderDeliveredEvent,
      {
        ...basePayload,
        delivery_date: normalizeDeliveredDate(
          pickFirst(scanTimestamp, payload?.delivery_date)
        ),
        order_url: getOrderDetailsUrl(shipment),
      },
      "ORDER_DELIVERED"
    );
  }

  if (
    shouldFireAutomation(
      previousShipmentStatus,
      nextShipmentStatus,
      CANCELLED_AUTOMATION_STATUSES
    )
  ) {
    await safeQueueAutomation(
      queueOrderCancelledEvent,
      {
        ...basePayload,
        cancelled_date: new Date().toISOString(),
      },
      "ORDER_CANCELLED"
    );
  }

  if (
    shouldFireAutomation(
      previousShipmentStatus,
      nextShipmentStatus,
      RETURNED_AUTOMATION_STATUSES
    )
  ) {
    await safeQueueAutomation(
      queueOrderReturnedEvent,
      {
        ...basePayload,
        return_date: new Date().toISOString(),
        awb_number: awbCode || shipment.awbCode || null,
      },
      "ORDER_RETURNED"
    );
  }
}

/* =====================================================
   SHIPROCKET: CREATE ORDER
===================================================== */

export async function createShiprocketOrder(payload) {
  return shiprocketRequest({
    method: "POST",
    endpoint: "/orders/create/adhoc",
    data: payload,
  });
}

/* =====================================================
   DB: CREATE / UPSERT SHIPMENT FROM ORDER
===================================================== */

export async function createShipmentForOrder(orderId, shiprocketPayload) {
  if (!orderId) {
    throw new Error("orderId is required");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      address: true,
      items: true,
      shipment: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const shiprocketResponse = await createShiprocketOrder(shiprocketPayload);

  const { shiprocketOrderId, shipmentId, awbCode } =
    extractShiprocketIds(shiprocketResponse);

  const shipment = await prisma.shipment.upsert({
    where: { orderId },
    create: {
      orderId,
      shiprocketOrderId,
      shipmentId,
      awbCode,
      courierId: null,
      courierName: null,
      shipmentStatus: normalizeShiprocketStatus("NEW"),
      pickupScheduledAt: null,
      pickupTokenNumber: null,
      assignedAt: null,
      isReturn: false,
    },
    update: {
      shiprocketOrderId: shiprocketOrderId || undefined,
      shipmentId: shipmentId || undefined,
      awbCode: awbCode || undefined,
      shipmentStatus: normalizeShiprocketStatus("NEW"),
    },
  });

  await appendTrackingEventWithClient(prisma, {
    shipmentDbId: shipment.id,
    status: normalizeShiprocketStatus("NEW"),
    activity: "Shipment created",
    location: "System",
    scanTimestamp: new Date(),
  });

  return {
    success: true,
    order,
    shipment,
    shiprocketResponse,
  };
}

export async function findShipment(identifier, include = {}) {
  return prisma.shipment.findFirst({
    where: {
      OR: [{ id: String(identifier) }, { shipmentId: String(identifier) }],
    },
    include,
  });
}

/* =====================================================
   SHIPROCKET: GENERATE AWB
===================================================== */

export async function generateAWB({ shipment_id, courier_id }) {
  return shiprocketRequest({
    method: "POST",
    endpoint: "/courier/assign/awb",
    data: {
      shipment_id,
      courier_id,
    },
  });
}

/* =====================================================
   DB: ASSIGN AWB TO SHIPMENT
===================================================== */

export async function assignAWBToShipment({ shipmentDbId, courierId }) {
  if (!shipmentDbId) {
    throw new Error("shipmentDbId is required");
  }

  const shipment = await findShipment(shipmentDbId, {
    order: true,
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  const externalShipmentId = getShipmentExternalId(shipment);

  if (!externalShipmentId) {
    throw new Error("No Shiprocket shipment id available for AWB generation");
  }

  const chosenCourierId = toNumber(courierId) || shipment.courierId;
  if (!chosenCourierId) {
    throw new Error("courierId is required for AWB generation");
  }

  const courierRecord = await prisma.courier.findUnique({
    where: { id: chosenCourierId },
  });

  const shiprocketResponse = await generateAWB({
    shipment_id: externalShipmentId,
    courier_id: chosenCourierId,
  });

  const { awbCode } = extractShiprocketIds(shiprocketResponse);

  const updatedShipment = await prisma.$transaction(async (tx) => {
    const next = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        awbCode: awbCode || shipment.awbCode,
        courierId: chosenCourierId,
        courierName: courierRecord?.name || shipment.courierName || null,
        shipmentStatus: shipment.shipmentStatus,
        assignedAt: new Date(),
      },
    });

    await appendTrackingEventWithClient(tx, {
      shipmentDbId: shipment.id,
      status: "AWB Assigned",
      activity: awbCode ? `AWB generated: ${awbCode}` : "AWB generated",
      location: "System",
      scanTimestamp: new Date(),
    });

    return next;
  });

  return {
    success: true,
    shipment: updatedShipment,
    shiprocketResponse,
  };
}

/* =====================================================
   SHIPROCKET: REQUEST PICKUP
===================================================== */

export async function requestPickup(shipment_id) {
  return shiprocketRequest({
    method: "POST",
    endpoint: "/courier/generate/pickup",
    data: {
      shipment_id: [shipment_id],
    },
  });
}

/* =====================================================
   DB: REQUEST PICKUP FOR SHIPMENT
===================================================== */

export async function requestPickupForShipment(shipmentDbId) {
  if (!shipmentDbId) {
    throw new Error("shipmentDbId is required");
  }

  const shipment = await findShipment(shipmentDbId, {
    order: {
      include: {
        user: true,
      },
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  const externalShipmentId = getShipmentExternalId(shipment);

  if (!externalShipmentId) {
    throw new Error("No Shiprocket shipment id available for pickup request");
  }

  const previousShipmentStatus = shipment.shipmentStatus || null;
  const nextShipmentStatus = getMutableShipmentStatus(
    shipment.shipmentStatus,
    normalizeShiprocketStatus("PICKUP_GENERATED")
  );

  const shiprocketResponse = await requestPickup(externalShipmentId);
  const { pickupTokenNumber } = extractShiprocketIds(shiprocketResponse);

  const updatedShipment = await prisma.$transaction(async (tx) => {
    const next = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        pickupScheduledAt: new Date(),
        pickupTokenNumber:
          pickupTokenNumber ||
          asString(
            pickFirst(
              shiprocketResponse?.pickup_token_number,
              shiprocketResponse?.pickupToken,
              shiprocketResponse?.token_number
            )
          ),
        shipmentStatus: nextShipmentStatus,
      },
    });

    await appendTrackingEventWithClient(tx, {
      shipmentDbId: shipment.id,
      status: normalizeShiprocketStatus("PICKUP_GENERATED"),
      activity: "Pickup requested",
      location: "System",
      scanTimestamp: new Date(),
    });

    return next;
  });

  if (previousShipmentStatus !== nextShipmentStatus) {
    await safeQueueAutomation(
      queueOrderPackedEvent,
      {
        customer_name: shipment?.order?.user?.name || null,
        email: shipment?.order?.user?.email || null,
        user_id: shipment?.order?.userId || null,
        order_id: shipment?.orderId || null,
        order_number: shipment?.order?.orderNumber || null,
        packed_date: new Date().toISOString(),
        order_url: getOrderDetailsUrl(shipment),
      },
      "ORDER_PACKED"
    );
  }

  return {
    success: true,
    shipment: updatedShipment,
    shiprocketResponse,
  };
}

/* =====================================================
   SHIPROCKET: AVAILABLE COURIERS / SERVICEABILITY
===================================================== */

export async function getAvailableCouriers({
  pickup_postcode,
  delivery_postcode,
  cod = 0,
  weight = 0.5,
  length = 10,
  breadth = 10,
  height = 5,
  declared_value = 500,
  mode = "Surface",
}) {
  if (!pickup_postcode) {
    throw new Error("pickup_postcode is required");
  }

  return shiprocketRequest({
    endpoint: "/courier/serviceability/",
    params: {
      pickup_postcode,
      delivery_postcode,
      cod,
      weight,
      length,
      breadth,
      height,
      declared_value,
      mode,
    },
  });
}

/* =====================================================
   DB: CHECK SERVICEABILITY + STORE RESULTS
===================================================== */

export async function checkServiceabilityAndStore({
  orderId = null,
  pincode = null,
  weight = 0.5,
  cod = 0,
  length = 10,
  breadth = 10,
  height = 5,
  declared_value = 500,
  mode = "Surface",
}) {
  const order = orderId
    ? await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          address: true,
        },
      })
    : null;

  const deliveryPostcode =
    pincode ||
    order?.shippingAddress?.pincode ||
    order?.address?.pincode ||
    order?.shippingAddress?.zipCode ||
    null;

  if (!deliveryPostcode) {
    throw new Error("Delivery pincode is required");
  }

  if (!WAREHOUSE_PINCODE) {
    throw new Error("WAREHOUSE_PINCODE missing");
  }

  const response = await getAvailableCouriers({
    pickup_postcode: WAREHOUSE_PINCODE,
    delivery_postcode: deliveryPostcode,
    cod,
    weight,
    length,
    breadth,
    height,
    declared_value,
    mode,
  });

  const couriers = extractAvailableCouriers(response);

  const syncedCouriers = [];
  for (const courier of couriers) {
    const record = await upsertCourierFromShiprocket(courier);
    if (record) syncedCouriers.push(record);
  }

  let bestCourier = null;
  for (const courier of couriers) {
    const currentDays = toNumber(
      pickFirst(
        courier?.estimated_delivery_days,
        courier?.estimatedDeliveryDays
      ),
      999
    );

    const bestDays = toNumber(
      pickFirst(
        bestCourier?.estimated_delivery_days,
        bestCourier?.estimatedDeliveryDays
      ),
      999
    );

    if (!bestCourier || currentDays < bestDays) {
      bestCourier = courier;
    }
  }

  const recommendedCourierId = toNumber(
    pickFirst(
      bestCourier?.courier_company_id,
      bestCourier?.courier_id,
      bestCourier?.id
    )
  );

  if (couriers.length) {
    await prisma.serviceabilityCheck.createMany({
      data: couriers.map((courier) => {
        const courierId = toNumber(
          pickFirst(
            courier?.courier_company_id,
            courier?.courier_id,
            courier?.id
          )
        );

        const estimatedDays = toNumber(
          pickFirst(
            courier?.estimated_delivery_days,
            courier?.estimatedDeliveryDays
          )
        );

        return {
          orderId: orderId || null,
          courierId: courierId || null,
          courierName:
            asString(
              pickFirst(courier?.courier_name, courier?.name)
            ) || null,
          estimatedDays,
          etd:
            asString(
              pickFirst(courier?.etd, courier?.estimated_delivery_date)
            ) || null,
          freightCharge: toNumber(
            pickFirst(courier?.freight_charge, courier?.rate, courier?.charge)
          ),
          rtoCharges: toNumber(
            pickFirst(courier?.rto_charges, courier?.rtoCharge)
          ),
          rating: toNumber(courier?.rating),
          isRecommended: courierId === recommendedCourierId,
        };
      }),
    });
  }

  return {
    success: true,
    serviceable: couriers.length > 0,
    delivery_postcode: deliveryPostcode,
    courier_count: couriers.length,
    recommended_courier: bestCourier
      ? {
          courier_company_id: toNumber(
            pickFirst(
              bestCourier?.courier_company_id,
              bestCourier?.courier_id,
              bestCourier?.id
            )
          ),
          courier_name: pickFirst(
            bestCourier?.courier_name,
            bestCourier?.name
          ),
          etd: bestCourier?.etd || null,
          estimated_delivery_days: toNumber(
            pickFirst(
              bestCourier?.estimated_delivery_days,
              bestCourier?.estimatedDeliveryDays
            )
          ),
          freight_charge: toNumber(
            pickFirst(
              bestCourier?.freight_charge,
              bestCourier?.rate,
              bestCourier?.charge
            )
          ),
          rating: toNumber(bestCourier?.rating),
        }
      : null,
    couriers: syncedCouriers,
    raw: response,
  };
}

/* =====================================================
   DB: SERVICEABILITY ONLY (COMPAT WRAPPER)
===================================================== */

export async function checkServiceability(pincode, options = {}) {
  const result = await checkServiceabilityAndStore({
    pincode,
    ...options,
  });

  return result?.raw?.data?.available_courier_companies || [];
}

/* =====================================================
   DB: DELIVERY ESTIMATE
===================================================== */

export async function getDeliveryEstimateService(pincode, options = {}) {
  const response = await checkServiceabilityAndStore({
    pincode,
    ...options,
  });

  const couriers = extractAvailableCouriers(response.raw);

  if (!couriers.length) {
    return {
      success: false,
      serviceable: false,
      couriers: [],
    };
  }

  const fastest = couriers.reduce((best, current) => {
    if (!best) return current;

    const currentDays = toNumber(
      pickFirst(
        current?.estimated_delivery_days,
        current?.estimatedDeliveryDays
      ),
      999
    );

    const bestDays = toNumber(
      pickFirst(best?.estimated_delivery_days, best?.estimatedDeliveryDays),
      999
    );

    return currentDays < bestDays ? current : best;
  }, null);

  return {
    success: true,
    serviceable: true,
    estimated_delivery: fastest?.etd || "ETA unavailable",
    fastest_courier: pickFirst(fastest?.courier_name, fastest?.name) || null,
    cod_available: couriers.some((courier) => courier?.cod === 1),
    courier_count: couriers.length,
    couriers: couriers.map((courier) => ({
      courier_company_id: toNumber(
        pickFirst(
          courier?.courier_company_id,
          courier?.courier_id,
          courier?.id
        )
      ),
      courier_name: pickFirst(courier?.courier_name, courier?.name),
      etd: courier?.etd || null,
      estimated_delivery_days: toNumber(
        pickFirst(
          courier?.estimated_delivery_days,
          courier?.estimatedDeliveryDays
        )
      ),
      rate: toNumber(courier?.rate),
      freight_charge: toNumber(
        pickFirst(courier?.freight_charge, courier?.rate, courier?.charge)
      ),
      cod: courier?.cod,
      rating: toNumber(courier?.rating),
      realtime_tracking: courier?.realtime_tracking || null,
      delivery_performance: courier?.delivery_performance || null,
      pickup_performance: courier?.pickup_performance || null,
      rto_performance: courier?.rto_performance || null,
      is_surface: courier?.is_surface,
      is_rto_address_available: courier?.is_rto_address_available,
    })),
  };
}

/* =====================================================
   DB: SHIPMENT TRACKING SYNC
===================================================== */

export async function trackShipment(shiprocketOrderId) {
  if (!shiprocketOrderId) {
    throw new Error("shiprocketOrderId is required");
  }

  return shiprocketRequest({
    endpoint: `/courier/track/shipment/${shiprocketOrderId}`,
  });
}

export async function getTrackingDetails(shiprocketOrderId) {
  return trackShipment(shiprocketOrderId);
}

export async function syncShipmentTracking(shipmentDbId) {
  if (!shipmentDbId) {
    throw new Error("shipmentDbId is required");
  }

  const shipment = await findShipment(shipmentDbId, {
    order: {
      include: {
        user: true,
      },
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  const previousShipmentStatus = shipment.shipmentStatus || null;
  const trackingId = getTrackingId(shipment);
  const response = await trackShipment(trackingId);
  const activities = extractTrackingActivities(response);

  const normalizedEvents = activities
    .map((evt) => {
      const normalized = normalizeTrackingEvent(evt);
      return {
        ...normalized,
        status: normalized.status || "Unknown",
        activity: normalized.activity || "Tracking update",
      };
    })
    .filter((evt) => evt.status || evt.activity || evt.location || evt.scanTimestamp);

  const deduped = [];
  const seen = new Set();

  for (const evt of normalizedEvents) {
    const key = buildTrackingEventKey(evt);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(evt);
  }

  const latestEvent =
    [...deduped].sort((a, b) => {
      const aTime = a.scanTimestamp ? new Date(a.scanTimestamp).getTime() : 0;
      const bTime = b.scanTimestamp ? new Date(b.scanTimestamp).getTime() : 0;
      return bTime - aTime;
    })[0] || null;

  let nextShipmentStatus = previousShipmentStatus;
  let updatedShipment = shipment;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.shipmentTracking.findMany({
      where: { shipmentId: shipment.id },
      select: {
        status: true,
        activity: true,
        location: true,
        scanTimestamp: true,
      },
    });

    const existingKeys = new Set(
      existing.map((item) => buildTrackingEventKey(item))
    );

    const rowsToInsert = deduped.filter(
      (evt) => !existingKeys.has(buildTrackingEventKey(evt))
    );

    if (rowsToInsert.length) {
      await tx.shipmentTracking.createMany({
        data: rowsToInsert.map((evt) => ({
          shipmentId: shipment.id,
          status: evt.status || "Unknown",
          activity: evt.activity || evt.status || "Tracking update",
          location: evt.location || null,
          scanTimestamp: evt.scanTimestamp || null,
        })),
      });
    }

    if (latestEvent?.status) {
      nextShipmentStatus =
        normalizeShiprocketStatus(latestEvent.status) || previousShipmentStatus;
      const nextOrderStatus = resolveNextOrderStatus(nextShipmentStatus);

      updatedShipment = await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          shipmentStatus: nextShipmentStatus,
        },
      });

      if (nextOrderStatus && shipment.orderId) {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: {
            status: nextOrderStatus,
          },
        });
      }
    }
  });

  if (previousShipmentStatus !== nextShipmentStatus) {
    await triggerShipmentAutomations({
      shipment,
      previousShipmentStatus,
      nextShipmentStatus,
      awbCode: shipment.awbCode || null,
      courierName: shipment.courierName || null,
      scanTimestamp: latestEvent?.scanTimestamp || null,
      payload: {
        delivery_date: latestEvent?.scanTimestamp || null,
      },
    });
  }

  return {
    success: true,
    shipmentId: shipment.id,
    events: deduped,
    raw: response,
    shipment: updatedShipment,
    previousShipmentStatus,
    nextShipmentStatus,
  };
}

/* =====================================================
   DB: SHIPMENT HELPERS
===================================================== */

export async function getShipmentDetails(identifier) {
  return findShipment(identifier, {
    order: {
      include: {
        user: true,
        address: true,
        items: true,
      },
    },
    trackingEvents: {
      orderBy: {
        createdAt: "desc",
      },
    },
  });
}

export async function listActiveCouriers() {
  return prisma.courier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getCourierById(courierId) {
  if (!courierId) return null;
  return prisma.courier.findUnique({
    where: { id: toNumber(courierId) },
  });
}

/* =====================================================
   DB: INVOICE
===================================================== */

export async function getInvoiceUrl(shiprocketOrderId) {
  if (!shiprocketOrderId) {
    throw new Error("shiprocketOrderId is required");
  }

  return shiprocketRequest({
    method: "POST",
    endpoint: "/orders/print/invoice",
    data: {
      ids: [Number(shiprocketOrderId)],
    },
  });
}

export async function downloadInvoiceForShipment(shipmentDbId) {
  if (!shipmentDbId) {
    throw new Error("shipmentDbId is required");
  }

  const shipment = await findShipment(shipmentDbId);

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  const trackingId = getTrackingId(shipment);
  return getInvoiceUrl(trackingId);
}

/* =====================================================
   DB: CANCEL SHIPMENT
===================================================== */

export async function cancelShipment(shiprocketOrderId) {
  if (!shiprocketOrderId) {
    throw new Error("Shiprocket Order ID is required");
  }

  return shiprocketRequest({
    method: "POST",
    endpoint: "/orders/cancel",
    data: {
      ids: [Number(shiprocketOrderId)],
    },
  });
}

export async function cancelShipmentForShipment(shipmentDbId) {
  if (!shipmentDbId) {
    throw new Error("shipmentDbId is required");
  }

  const shipment = await findShipment(shipmentDbId, {
    order: {
      include: {
        user: true,
      },
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  return cancelOrderService(shipment.order?.userId, shipment.orderId);
}

/* =====================================================
   NEW DB-LEVEL SHIPMENT UPDATE / TRACKING HELPERS
===================================================== */

export async function appendTrackingEvent({
  shipmentDbId,
  status,
  activity = null,
  location = null,
  scanTimestamp = null,
}) {
  return appendTrackingEventWithClient(prisma, {
    shipmentDbId,
    status,
    activity,
    location,
    scanTimestamp,
  });
}

export async function updateShipmentStatus({
  shipmentDbId,
  shipmentStatus,
  activity = null,
  location = null,
  scanTimestamp = null,
  courierId = undefined,
  courierName = undefined,
  awbCode = undefined,
  pickupTokenNumber = undefined,
  assignedAt = undefined,
  shiprocketOrderId = undefined,
  shipmentId = undefined,
}) {
  return prisma.$transaction(async (tx) => {
    return updateShipmentStatusWithClient(tx, {
      shipmentDbId,
      shipmentStatus,
      activity,
      location,
      scanTimestamp,
      courierId,
      courierName,
      awbCode,
      pickupTokenNumber,
      assignedAt,
      shiprocketOrderId,
      shipmentId,
    });
  });
}

/* =====================================================
   SHIPROCKET WEBHOOK PROCESSOR
===================================================== */

export async function processShiprocketWebhook(payload) {
  if (!payload) {
    throw new Error("Webhook payload is required");
  }

  const shipmentRefId = pickFirst(
    payload?.shipment_id,
    payload?.shipmentId,
    payload?.shipmentID
  );

  const shiprocketOrderId = pickFirst(
    payload?.order_id,
    payload?.orderId,
    payload?.shiprocket_order_id,
    payload?.shiprocketOrderId
  );

  const shipmentIdString = shipmentRefId ? String(shipmentRefId) : null;
  const orderIdString = shiprocketOrderId ? String(shiprocketOrderId) : null;

  let shipment = null;

  if (shipmentIdString) {
    shipment = await prisma.shipment.findUnique({
      where: { shipmentId: shipmentIdString },
      include: {
        order: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  if (!shipment && orderIdString) {
    shipment = await prisma.shipment.findFirst({
      where: { shiprocketOrderId: orderIdString },
      include: {
        order: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  if (!shipment) {
    return {
      success: false,
      reason: "Shipment not found",
    };
  }

  if (shipment.order && isOrderTerminalStatus(shipment.order.status)) {
    return {
      success: true,
      skipped: true,
    };
  }

  const rawShipmentStatus = pickFirst(
    payload?.status,
    payload?.current_status,
    payload?.shipment_status,
    payload?.event_status,
    payload?.tracking_status
  );

  const normalizedIncomingStatus = normalizeShiprocketStatus(rawShipmentStatus);

  const activity = pickFirst(
    payload?.activity,
    payload?.note,
    payload?.details,
    payload?.description,
    payload?.current_status,
    normalizedIncomingStatus
  );

  const location = pickFirst(
    payload?.location,
    payload?.city,
    payload?.hub_name,
    payload?.scanned_location,
    payload?.destination
  );

  const scanTimestamp = pickFirst(
    payload?.scan_timestamp,
    payload?.scanTimestamp,
    payload?.date,
    payload?.created_at,
    payload?.updated_at
  );

  const awbCode = pickFirst(payload?.awb_code, payload?.awbCode);

  const courierId = toNumber(
    pickFirst(
      payload?.courier_company_id,
      payload?.courier_id,
      payload?.courierId
    )
  );

  const courierName = pickFirst(payload?.courier_name, payload?.courierName);

  const pickupTokenNumber = pickFirst(
    payload?.pickup_token_number,
    payload?.pickupTokenNumber,
    payload?.pickup_token,
    payload?.pickupToken
  );

  const previousShipmentStatus = shipment.shipmentStatus || null;

  const updateResult = await updateShipmentStatus({
    shipmentDbId: shipment.id,
    shipmentStatus: normalizedIncomingStatus || shipment.shipmentStatus,
    activity: activity || "Webhook update",
    location,
    scanTimestamp,
    courierId: courierId || undefined,
    courierName: courierName || undefined,
    awbCode: awbCode || undefined,
    pickupTokenNumber: pickupTokenNumber || undefined,
    assignedAt: shipment.assignedAt || undefined,
    shiprocketOrderId: orderIdString || undefined,
    shipmentId: shipmentIdString || undefined,
  });

  const nextShipmentStatus = updateResult.nextShipmentStatus;

  if (previousShipmentStatus === nextShipmentStatus) {
    return {
      success: true,
      shipment: updateResult.shipment,
      previousShipmentStatus,
      nextShipmentStatus,
      orderId: shipment.orderId,
      skipped: true,
    };
  }

  await triggerShipmentAutomations({
    shipment,
    previousShipmentStatus,
    nextShipmentStatus,
    awbCode: awbCode || shipment.awbCode || null,
    courierName: courierName || shipment.courierName || null,
    scanTimestamp,
    payload,
  });

  await emitOrderEvent("shiprocket.webhook.processed", {
    shipmentDbId: shipment.id,
    orderId: shipment.orderId,
    shipmentStatus: nextShipmentStatus,
    rawPayload: payload,
  });

  return {
    success: true,
    shipment: updateResult.shipment,
    previousShipmentStatus,
    nextShipmentStatus,
    orderId: shipment.orderId,
  };
}

/* =====================================================
   OPTIONAL: SYNC SHIPROCKET COURIERS INTO DB
===================================================== */

export async function syncCouriersToDbFromServiceability({
  pickup_postcode,
  delivery_postcode,
  cod = 0,
  weight = 0.5,
  length = 10,
  breadth = 10,
  height = 5,
  declared_value = 500,
  mode = "Surface",
}) {
  const response = await getAvailableCouriers({
    pickup_postcode,
    delivery_postcode,
    cod,
    weight,
    length,
    breadth,
    height,
    declared_value,
    mode,
  });

  const couriers = extractAvailableCouriers(response);
  const synced = [];

  for (const courier of couriers) {
    const record = await upsertCourierFromShiprocket(courier);
    if (record) synced.push(record);
  }

  return {
    success: true,
    count: synced.length,
    couriers: synced,
    raw: response,
  };
}

export async function getShiprocketOrders(params = {}) {
  return shiprocketRequest({
    method: "GET",
    endpoint: "/orders",
    params,
  });
}

export async function getShiprocketOrderDetails(shiprocketOrderId) {
  if (!shiprocketOrderId) {
    throw new Error("shiprocketOrderId is required");
  }

  return shiprocketRequest({
    method: "GET",
    endpoint: `/orders/show/${shiprocketOrderId}`,
  });
}

export async function createReturnOrder(payload) {
  return shiprocketRequest({
    method: "POST",
    endpoint: "/orders/create/return",
    data: payload,
  });
}

export async function updateReturnOrder(payload) {
  return shiprocketRequest({
    method: "POST",
    endpoint: "/orders/edit",
    data: payload,
  });
}

export async function getReturnOrders(params = {}) {
  return shiprocketRequest({
    method: "GET",
    endpoint: "/orders/processing/return",
    params,
  });
}

export async function createExchangeOrder(payload) {
  return shiprocketRequest({
    method: "POST",
    endpoint: "/orders/create/exchange",
    data: payload,
  });
}

/* =====================================================
   DEFAULT EXPORT
===================================================== */

export default {
  getShiprocketToken,
  createShiprocketOrder,
  createShipmentForOrder,
  getShiprocketOrders,
  getShiprocketOrderDetails,
  generateAWB,
  assignAWBToShipment,
  requestPickup,
  requestPickupForShipment,
  getAvailableCouriers,
  listActiveCouriers,
  getCourierById,
  syncCouriersToDbFromServiceability,
  checkServiceability,
  checkServiceabilityAndStore,
  getDeliveryEstimateService,
  trackShipment,
  getTrackingDetails,
  syncShipmentTracking,
  getShipmentDetails,
  appendTrackingEvent,
  updateShipmentStatus,
  isOrderTerminalStatus,
  getInvoiceUrl,
  downloadInvoiceForShipment,
  cancelShipment,
  cancelShipmentForShipment,
  createReturnOrder,
  updateReturnOrder,
  getReturnOrders,
  createExchangeOrder,
  processShiprocketWebhook,
};
