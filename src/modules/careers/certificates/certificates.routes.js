import express from "express";
import multer from "multer";

import {
  createCertificate,
  getCertificateByApplication,
  verifyCertificate,
  certificateVerificationPage,
  downloadCertificatePDF,
} from "./certificates.controller.js";

import { adminAuth }
from "../../../middlewares/admin.middleware.js";

const router = express.Router();

/* =========================================
   📁 MULTER MEMORY STORAGE
========================================= */

const upload = multer({
  storage: multer.memoryStorage(),
});

/* =========================================
   🔐 ADMIN ROUTES
========================================= */

// ➕ Create certificate
router.post(
  "/",
  adminAuth,
  upload.fields([
    {
      name: "certificate",
      maxCount: 1,
    },
    {
      name: "qr",
      maxCount: 1,
    },
  ]),
  createCertificate
);

// 📦 Get by application
router.get(
  "/application/:applicationId",
  adminAuth,
  getCertificateByApplication
);

/* =========================================
   🌍 PUBLIC ROUTES
========================================= */

// 🌍 JSON verify
router.get(
  "/public/:certificateId",
  verifyCertificate
);

// 🌍 HTML verification page
router.get(
  "/public/view/:certificateId",
  certificateVerificationPage
);

// 📄 Download PDF
router.get(
  "/:certificateId/download-pdf",
  downloadCertificatePDF
);

export default router;