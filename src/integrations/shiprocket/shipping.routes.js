// src/modules/shipping/shipping.routes.js

import express from "express";

import {
  getDeliveryEstimate,
  checkDeliveryServiceability,

  assignAWBController,
  getCouriersController,
  listCouriersController,

  requestPickupController,

  trackShipmentController,
  syncShipmentTrackingController,

  getShipmentController,

  getInvoiceController,

  cancelShipmentController,

  processShiprocketWebhookController,
} from "./shipping.controller.js";

const router = express.Router();

/* =====================================================
   SERVICEABILITY
===================================================== */

router.get(
  "/estimate/:pincode",
  getDeliveryEstimate
);

router.post(
  "/serviceability",
  checkDeliveryServiceability
);

/* =====================================================
   COURIERS
===================================================== */

router.get(
  "/couriers",
  getCouriersController
);

/*
  Active couriers stored in DB
*/
router.get(
  "/couriers/list",
  listCouriersController
);

/* =====================================================
   SHIPMENT OPERATIONS
===================================================== */

/*
  Generate AWB

  body:
  {
    shipmentDbId,
    courierId
  }
*/
router.post(
  "/assign-awb",
  assignAWBController
);

/*
  Request Pickup

  body:
  {
    shipmentDbId
  }
*/
router.post(
  "/pickup",
  requestPickupController
);

/*
  Shipment Details
*/
router.get(
  "/shipment/:shipmentDbId",
  getShipmentController
);

/*
  Sync Tracking from Shiprocket
*/
router.post(
  "/shipment/:shipmentDbId/sync",
  syncShipmentTrackingController
);

/* =====================================================
   TRACKING
===================================================== */

/*
  Direct Shiprocket Tracking
*/
router.get(
  "/track/:shiprocketOrderId",
  trackShipmentController
);

/* =====================================================
   INVOICE
===================================================== */

/*
  Recommended
*/
router.get(
  "/invoice/shipment/:shipmentDbId",
  getInvoiceController
);

/*
  Legacy Support
*/
router.get(
  "/invoice/order/:shiprocketOrderId",
  getInvoiceController
);

/* =====================================================
   CANCEL SHIPMENT
===================================================== */

/*
  Recommended

  body:
  {
    shipmentDbId
  }
*/
router.post(
  "/cancel",
  cancelShipmentController
);

/* =====================================================
   SHIPROCKET WEBHOOK
===================================================== */

router.post(
  "/webhook/shiprocket",
  processShiprocketWebhookController
);

export default router;
