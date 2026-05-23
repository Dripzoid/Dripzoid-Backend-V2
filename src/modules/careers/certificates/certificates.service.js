import cloudinary from "../../../config/cloudinary.js";

import prisma from "../../../lib/prisma.js";

/* ======================================================
   CLOUDINARY BUFFER UPLOAD
====================================================== */

function uploadBuffer(
  buffer,
  options = {}
) {
  return new Promise(
    (resolve, reject) => {
      const stream =
        cloudinary.uploader.upload_stream(
          options,
          (err, result) => {
            if (err) {
              return reject(err);
            }

            resolve(result);
          }
        );

      stream.end(buffer);
    }
  );
}

/* ======================================================
   GET CERTIFICATE BY APPLICATION
====================================================== */

export async function getCertificateByApplicationService(
  applicationId
) {
  const certificate =
    await prisma.certificate.findFirst({
      where: {
        applicationId,
      },
    });

  if (!certificate) {
    throw new Error(
      "Certificate not found"
    );
  }

  return certificate;
}

/* ======================================================
   VERIFY CERTIFICATE
====================================================== */

export async function verifyCertificateService(
  certificateId
) {
  return prisma.certificate.findUnique({
    where: {
      id: certificateId,
    },

    include: {
      application: true,
    },
  });
}

/* ======================================================
   CREATE CERTIFICATE
====================================================== */

export async function createCertificateService({
  body,
  files,
}) {
  const {
    application_id,
    certificate_id,
    intern_name,
    role,
    start_date,
    end_date,
    issue_date,
  } = body;

  /* =========================
     VALIDATION
  ========================= */

  if (
    !application_id ||
    !certificate_id ||
    !intern_name
  ) {
    throw new Error(
      "Missing required fields"
    );
  }

  /* =========================
     CHECK APPLICATION
  ========================= */

  const application =
    await prisma.application.findUnique({
      where: {
        id: application_id,
      },
    });

  if (!application) {
    throw new Error(
      "Application not found"
    );
  }

  /* =========================
     CHECK EXISTING CERTIFICATE
  ========================= */

  const existingCertificate =
    await prisma.certificate.findFirst({
      where: {
        applicationId:
          application_id,
      },
    });

  if (existingCertificate) {
    return {
      alreadyExists: true,

      ...existingCertificate,
    };
  }

  /* =========================
     CERTIFICATE FILE
  ========================= */

  const certFile =
    files?.certificate?.[0];

  if (!certFile) {
    throw new Error(
      "Certificate image required"
    );
  }

  /* =========================
     UPLOAD CERTIFICATE
  ========================= */

  const certUpload =
    await uploadBuffer(
      certFile.buffer,
      {
        resource_type: "image",

        folder: "certificates",

        public_id:
          certificate_id,

        overwrite: true,
      }
    );

  /* =========================
     OPTIONAL QR UPLOAD
  ========================= */

  let qr_url = null;

  const qrFile =
    files?.qr?.[0];

  if (qrFile) {
    const qrUpload =
      await uploadBuffer(
        qrFile.buffer,
        {
          resource_type:
            "image",

          folder:
            "certificates/qr",

          public_id:
            `${certificate_id}-qr`,

          overwrite: true,
        }
      );

    qr_url =
      qrUpload.secure_url;
  }

  /* =========================
     CREATE CERTIFICATE
  ========================= */

  const certificate =
    await prisma.certificate.create({
      data: {
        id: certificate_id,

        applicationId:
          application_id,

        internName:
          intern_name,

        role:
          role || null,

        startDate:
          start_date
            ? new Date(
                start_date
              )
            : null,

        endDate:
          end_date
            ? new Date(
                end_date
              )
            : null,

        issueDate:
          issue_date
            ? new Date(
                issue_date
              )
            : null,

        certificateUrl:
          certUpload.secure_url,

        qrUrl: qr_url,
      },
    });

  /* =========================
     UPDATE APPLICATION
  ========================= */

  await prisma.application.update({
    where: {
      id: application_id,
    },

    data: {
      certificateGenerated: true,
    },
  });

  /* =========================
     RESPONSE
  ========================= */

  return {
    success: true,

    certificate_id:
      certificate.id,

    certificate_url:
      certificate.certificateUrl,

    qr_url:
      certificate.qrUrl,
  };
}