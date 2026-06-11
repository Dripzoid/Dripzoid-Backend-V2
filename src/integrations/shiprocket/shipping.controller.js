// src/controllers/shipping.controller.js
import {
  assignAWBToShipment,
  requestPickupForShipment,
  getAvailableCouriers,
  getTrackingDetails,
  syncShipmentTracking,
  getInvoiceUrl,
  downloadInvoiceForShipment,
  cancelShipmentForShipment,
  cancelShipment,
  checkServiceabilityAndStore,
  getDeliveryEstimateService,
  listActiveCouriers,
  getShipmentDetails,
  processShiprocketWebhook,
} from "./shiprocket.service.js";

function parseNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseBoolean(value) {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  return false;
}

function getShipmentDbId(req) {
  return (
    req.params?.shipmentDbId ||
    req.params?.shipmentId ||
    req.body?.shipmentDbId ||
    req.body?.shipmentId ||
    req.query?.shipmentDbId ||
    req.query?.shipmentId ||
    null
  );
}

function getShiprocketOrderId(req) {
  return (
    req.params?.shiprocketOrderId ||
    req.body?.shiprocketOrderId ||
    req.query?.shiprocketOrderId ||
    null
  );
}

function getCourierId(req) {
  return (
    req.body?.courierId ||
    req.body?.courier_id ||
    req.query?.courierId ||
    req.query?.courier_id ||
    null
  );
}

function getPincode(req) {
  return (
    req.body?.pincode ||
    req.query?.pincode ||
    req.params?.pincode ||
    null
  );
}

function courierQueryPayload(req) {
  return {
    pickup_postcode:
      req.query?.pickup_postcode ||
      process.env.WAREHOUSE_PINCODE ||
      process.env.SHIPROCKET_PICKUP_PINCODE ||
      "",
    delivery_postcode:
      req.query?.delivery_postcode ||
      req.query?.pincode ||
      req.body?.pincode ||
      null,
    cod: parseNumber(req.query?.cod, 0),
    weight: parseNumber(req.query?.weight, 0.5),
    length: parseNumber(req.query?.length, 10),
    breadth: parseNumber(req.query?.breadth, 10),
    height: parseNumber(req.query?.height, 5),
    declared_value: parseNumber(req.query?.declared_value, 500),
    mode: req.query?.mode || "Surface",
  };
}

/* =====================================================
   SHIPMENT: ASSIGN AWB
===================================================== */

export async function assignAWBController(req, res, next) {
  try {
    const shipmentDbId = getShipmentDbId(req);
    const courierId = getCourierId(req);

    if (!shipmentDbId) {
      return res.status(400).json({
        success: false,
        message: "shipmentDbId is required",
      });
    }

    if (!courierId) {
      return res.status(400).json({
        success: false,
        message: "courierId is required",
      });
    }

    const response = await assignAWBToShipment({
      shipmentDbId,
      courierId: parseNumber(courierId),
    });

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   SHIPMENT: REQUEST PICKUP
===================================================== */

export async function requestPickupController(req, res, next) {
  try {
    const shipmentDbId = getShipmentDbId(req);

    if (!shipmentDbId) {
      return res.status(400).json({
        success: false,
        message: "shipmentDbId is required",
      });
    }

    const response = await requestPickupForShipment(shipmentDbId);

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   COURIERS: SHIPROCKET SERVICEABILITY LIST
===================================================== */

export async function getCouriersController(req, res, next) {
  try {
    const payload = courierQueryPayload(req);

    if (!payload.delivery_postcode) {
      return res.status(400).json({
        success: false,
        message: "pincode or delivery_postcode is required",
      });
    }

    const response = await getAvailableCouriers(payload);

    return res.status(200).json({
      success: true,
      data: response?.data?.available_courier_companies || [],
      raw: response,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   COURIERS: ACTIVE MASTER DATA FROM DB
===================================================== */

export async function listCouriersController(req, res, next) {
  try {
    const couriers = await listActiveCouriers();

    return res.status(200).json({
      success: true,
      data: couriers,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   SERVICEABILITY: CHECK + STORE
===================================================== */

export async function checkDeliveryServiceability(req, res, next) {
  try {
    const pincode = getPincode(req);
    const orderId = req.body?.orderId || req.query?.orderId || null;

    const weight = parseNumber(req.body?.weight ?? req.query?.weight, 0.5);
    const cod = parseBoolean(req.body?.cod ?? req.query?.cod) ? 1 : 0;
    const length = parseNumber(req.body?.length ?? req.query?.length, 10);
    const breadth = parseNumber(req.body?.breadth ?? req.query?.breadth, 10);
    const height = parseNumber(req.body?.height ?? req.query?.height, 5);
    const declared_value = parseNumber(
      req.body?.declared_value ?? req.query?.declared_value,
      500
    );
    const mode = req.body?.mode || req.query?.mode || "Surface";

    if (!pincode && !orderId) {
      return res.status(400).json({
        success: false,
        message: "pincode or orderId is required",
      });
    }

    const result = await checkServiceabilityAndStore({
      orderId,
      pincode,
      weight,
      cod,
      length,
      breadth,
      height,
      declared_value,
      mode,
    });

    return res.status(200).json({
      success: true,
      serviceable: result.serviceable,
      delivery_postcode: result.delivery_postcode,
      courier_count: result.courier_count,
      recommended_courier: result.recommended_courier,
      couriers: result.raw?.data?.available_courier_companies || [],
      synced_couriers: result.couriers || [],
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   DELIVERY ESTIMATE
===================================================== */

export async function getDeliveryEstimate(req, res, next) {
  try {
    const pincode =
      req.params?.pincode ||
      req.query?.pincode ||
      req.body?.pincode ||
      null;

    if (!pincode) {
      return res.status(400).json({
        success: false,
        message: "pincode is required",
      });
    }

    const result = await getDeliveryEstimateService(pincode, {
      weight: parseNumber(req.query?.weight, 0.5),
      cod: parseBoolean(req.query?.cod) ? 1 : 0,
      length: parseNumber(req.query?.length, 10),
      breadth: parseNumber(req.query?.breadth, 10),
      height: parseNumber(req.query?.height, 5),
      declared_value: parseNumber(req.query?.declared_value, 500),
      mode: req.query?.mode || "Surface",
    });

    return res.status(200).json({
      success: true,
      serviceable: result.serviceable,
      estimated_delivery: result.estimated_delivery,
      fastest_courier: result.fastest_courier,
      cod_available: result.cod_available,
      courier_count: result.courier_count,
      couriers: result.couriers,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   TRACKING: DIRECT SHIPROCKET TRACK
===================================================== */

export async function trackShipmentController(req, res, next) {
  try {
    const shiprocketOrderId = getShiprocketOrderId(req);

    if (!shiprocketOrderId) {
      return res.status(400).json({
        success: false,
        message: "shiprocketOrderId is required",
      });
    }

    const response = await getTrackingDetails(shiprocketOrderId);

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   TRACKING: SYNC SHIPMENT INTO DB
===================================================== */

export async function syncShipmentTrackingController(req, res, next) {
  try {
    const shipmentDbId = getShipmentDbId(req);

    if (!shipmentDbId) {
      return res.status(400).json({
        success: false,
        message: "shipmentDbId is required",
      });
    }

    const response = await syncShipmentTracking(shipmentDbId);

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   SHIPMENT DETAILS
===================================================== */

export async function getShipmentController(req, res, next) {
  try {
    const shipmentDbId = getShipmentDbId(req);

    if (!shipmentDbId) {
      return res.status(400).json({
        success: false,
        message: "shipmentDbId is required",
      });
    }

    const shipment = await getShipmentDetails(shipmentDbId);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   INVOICE: SHIPMENT-FIRST
===================================================== */

export async function getInvoiceController(req, res, next) {
  try {
    const shipmentDbId = getShipmentDbId(req);
    const shiprocketOrderId = getShiprocketOrderId(req);

    let response;

    if (shipmentDbId) {
      response = await downloadInvoiceForShipment(shipmentDbId);
    } else if (shiprocketOrderId) {
      response = await getInvoiceUrl(shiprocketOrderId);
    } else {
      return res.status(400).json({
        success: false,
        message: "shipmentDbId or shiprocketOrderId is required",
      });
    }

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   CANCEL SHIPMENT
===================================================== */

export async function cancelShipmentController(req, res, next) {
  try {
    const shipmentDbId = getShipmentDbId(req);
    const shiprocketOrderId = getShiprocketOrderId(req);

    let response;

    if (shipmentDbId) {
      response = await cancelShipmentForShipment(shipmentDbId);
    } else if (shiprocketOrderId) {
      response = await cancelShipment(shiprocketOrderId);
    } else {
      return res.status(400).json({
        success: false,
        message: "shipmentDbId or shiprocketOrderId is required",
      });
    }

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   SHIPROCKET WEBHOOK
===================================================== */

export async function processShiprocketWebhookController(req, res, next) {
  try {
    const response = await processShiprocketWebhook(req.body);

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

/* =====================================================
   OPTIONAL COMPAT WRAPPERS
   Keep these only if your routes already point to old names.
===================================================== */

export const getAvailableCouriersController = getCouriersController;
export const checkServiceabilityController = checkDeliveryServiceability;
export const downloadInvoiceController = getInvoiceController;
export const syncTrackingController = syncShipmentTrackingController;
export const getShipmentDetailsController = getShipmentController;
