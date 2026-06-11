// src/modules/shipping/shipping.routes.js

import express from "express";

import {
  getDeliveryEstimate,
  checkDeliveryServiceability,

  getCouriersController,
  listCouriersController,

  assignAWBController,
  requestPickupController,
  getShipmentController,

  trackShipmentController,
  syncShipmentTrackingController,

  getInvoiceController,

  cancelShipmentController,

  getShiprocketOrdersController,
  getShiprocketOrderController,

  createReturnOrderController,
  updateReturnOrderController,
  getReturnOrdersController,

  createExchangeOrderController,
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

router.get(
  "/couriers/list",
  listCouriersController
);

/* =====================================================
   SHIPMENT OPERATIONS
===================================================== */

router.post(
  "/assign-awb",
  assignAWBController
);

router.post(
  "/pickup",
  requestPickupController
);

router.get(
  "/shipment/:shipmentDbId",
  getShipmentController
);

router.post(
  "/shipment/:shipmentDbId/sync",
  syncShipmentTrackingController
);

/* =====================================================
   TRACKING
===================================================== */

router.get(
  "/track/:shiprocketOrderId",
  trackShipmentController
);

/* =====================================================
   INVOICE
===================================================== */

router.get(
  "/invoice/shipment/:shipmentDbId",
  getInvoiceController
);

router.get(
  "/invoice/order/:shiprocketOrderId",
  getInvoiceController
);

/* =====================================================
   CANCEL SHIPMENT
===================================================== */

router.post(
  "/cancel",
  cancelShipmentController
);

/* =====================================================
   SHIPROCKET ORDERS
===================================================== */

router.get(
  "/orders",
  getShiprocketOrdersController
);

router.get(
  "/orders/:shiprocketOrderId",
  getShiprocketOrderController
);

/* =====================================================
   RETURNS
===================================================== */

router.post(
  "/returns",
  createReturnOrderController
);

router.put(
  "/returns",
  updateReturnOrderController
);

router.get(
  "/returns",
  getReturnOrdersController
);

/* =====================================================
   EXCHANGE
===================================================== */

router.post(
  "/exchange",
  createExchangeOrderController
);

export default router;
