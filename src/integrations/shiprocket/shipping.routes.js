import express from "express";

import {
  getDeliveryEstimate,
  checkDeliveryServiceability,

  assignAWBController,
  getCouriersController,
  requestPickupController,
  trackShipmentController,
  getInvoiceController,
  cancelShipmentController,
} from "./shipping.controller.js";

const router = express.Router();

/* Existing */

router.get(
  "/estimate/:pincode",
  getDeliveryEstimate
);

router.post(
  "/serviceability",
  checkDeliveryServiceability
);

/* New */

router.get(
  "/couriers",
  getCouriersController
);

router.post(
  "/assign-awb",
  assignAWBController
);

router.post(
  "/pickup",
  requestPickupController
);

router.get(
  "/track/:shiprocketOrderId",
  trackShipmentController
);

router.get(
  "/invoice/:shiprocketOrderId",
  getInvoiceController
);

router.post(
  "/cancel",
  cancelShipmentController
);

export default router;
