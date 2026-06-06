import express from "express";

import {
  getDeliveryEstimate,
  checkDeliveryServiceability,
  trackOrderShipment,
  downloadInvoice,
} from "./shipping.controller.js";

const router = express.Router();

/* =====================================================
   📦 DELIVERY ESTIMATE
===================================================== */

router.get(
  "/estimate/:pincode",
  getDeliveryEstimate
);

/* =====================================================
   🚚 SERVICEABILITY
===================================================== */

router.post(
  "/serviceability",
  checkDeliveryServiceability
);

/* =====================================================
   📍 TRACK ORDER
===================================================== */

router.get(
  "/track/:awb",
  trackOrderShipment
);

/* =====================================================
   🧾 DOWNLOAD INVOICE
===================================================== */

router.get(
  "/invoice/:orderId",
  downloadInvoice
);

export default router;
