import express from "express";

import {
  adminAuth,
} from "../../middlewares/admin.middleware.js";

import {
  sendCertificateEmail,
} from "./email.controller.js";

const router =
  express.Router();

/* =====================================================
   📧 SEND CERTIFICATE EMAIL
===================================================== */

router.post(
  "/send-certificate",

  adminAuth,

  sendCertificateEmail
);

export default router;