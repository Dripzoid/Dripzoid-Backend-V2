import {
  AppError,
} from "../../errors/AppError.js";

import {
  sendCertificateEmailService,
} from "./email.service.js";

/* =====================================================
   📧 SEND CERTIFICATE EMAIL
===================================================== */

export async function sendCertificateEmail(
  req,
  res,
  next
) {

  try {

    const {
      to,
      internName,
      role,
      certificateImageUrl,
      certificateDownloadUrl,
    } = req.body;

    /* =========================================
       VALIDATION
    ========================================= */

    if (
      !to ||
      !internName ||
      !certificateImageUrl
    ) {

      throw new AppError(
        "Missing required fields",

        400
      );
    }

    /* =========================================
       SEND EMAIL
    ========================================= */

    await sendCertificateEmailService({
      to,
      internName,
      role,
      certificateImageUrl,
      certificateDownloadUrl,
    });

    /* =========================================
       RESPONSE
    ========================================= */

    return res.status(200).json({
      success: true,

      message:
        "Certificate email sent successfully",
    });

  } catch (error) {

    next(error);
  }
}