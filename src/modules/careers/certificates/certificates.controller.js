import PDFDocument from "pdfkit";

import {
  createCertificateService,
  getCertificateByApplicationService,
  verifyCertificateService,
} from "./certificates.service.js";

import {
  validCertificateHTML,
  invalidCertificateHTML,
} from "./certificate.template.js";

// ➕ CREATE CERTIFICATE
export const createCertificate =
  async (req, res) => {
    try {
      const result =
        await createCertificateService({
          body: req.body,
          files: req.files,
        });

      res.json(result);
    } catch (err) {
      console.error(
        "createCertificate error:",
        err
      );

      res.status(500).json({
        message:
          err.message ||
          "Failed to upload certificate",
      });
    }
  };

// 📦 GET CERTIFICATE BY APPLICATION
export const getCertificateByApplication =
  async (req, res) => {
    try {
      const row =
        await getCertificateByApplicationService(
          req.params.applicationId
        );

      res.json(row);
    } catch (err) {
      console.error(
        "getCertificateByApplication error:",
        err
      );

      res.status(404).json({
        message:
          err.message ||
          "Certificate not found",
      });
    }
  };

// 🌍 PUBLIC JSON VERIFY
export const verifyCertificate =
  async (req, res) => {
    try {
      const row =
        await verifyCertificateService(
          req.params.certificateId
        );

      if (!row) {
        return res.status(404).json({
          valid: false,
          message:
            "Certificate not found",
        });
      }

      res.json({
        valid: true,
        certificate_id: row.id,
        intern_name:
          row.intern_name,
        role: row.role,
        start_date:
          row.start_date,
        end_date:
          row.end_date,
        issue_date:
          row.issue_date,
        certificate_url:
          row.certificate_url,
      });
    } catch (err) {
      console.error(
        "verifyCertificate error:",
        err
      );

      res.status(500).json({
        message:
          "Verification failed",
      });
    }
  };

// 🌍 PUBLIC HTML PAGE
export const certificateVerificationPage =
  async (req, res) => {
    try {
      const row =
        await verifyCertificateService(
          req.params.certificateId
        );

      if (!row) {
        return res.send(
          invalidCertificateHTML()
        );
      }

      res.send(
        validCertificateHTML(row)
      );
    } catch (err) {
      console.error(
        "certificateVerificationPage error:",
        err
      );

      res
        .status(500)
        .send(
          "Verification failed"
        );
    }
  };

// 📄 DOWNLOAD PDF
export const downloadCertificatePDF =
  async (req, res) => {
    try {
      const row =
        await verifyCertificateService(
          req.params.certificateId
        );

      if (
        !row ||
        !row.certificate_url
      ) {
        return res
          .status(404)
          .json({
            message:
              "Certificate image not found",
          });
      }

      // fetch image
      const imageResponse =
        await fetch(
          row.certificate_url
        );

      const imageBuffer =
        Buffer.from(
          await imageResponse.arrayBuffer()
        );

      // create pdf
      const doc =
        new PDFDocument({
          size: "A4",
          layout: "landscape",
          margin: 0,
        });

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${req.params.certificateId}.pdf"`
      );

      doc.pipe(res);

      doc.image(
        imageBuffer,
        0,
        0,
        {
          width:
            doc.page.width,

          height:
            doc.page.height,
        }
      );

      doc.end();
    } catch (err) {
      console.error(
        "downloadCertificatePDF error:",
        err
      );

      res.status(500).json({
        message:
          "Failed to generate PDF",
      });
    }
  };