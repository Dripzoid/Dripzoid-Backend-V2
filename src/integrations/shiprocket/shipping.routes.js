import express from "express";

import {
  getDeliveryEstimate,
  checkDeliveryServiceability,
} from "./shipping.controller.js";

const router =
  express.Router();

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

export default router;
