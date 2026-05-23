import {
  sendMSG91Email,
} from "../../integrations/msg91/msg91.service.js";

import {
  MSG91_TEMPLATES,
} from "../../integrations/msg91/msg91.templates.js";

/* =====================================================
   📧 SEND CERTIFICATE EMAIL
===================================================== */

export async function sendCertificateEmailService({
  to,
  internName,
  role,
  certificateImageUrl,
  certificateDownloadUrl,
}) {

  return sendMSG91Email({
    to,

    templateId:
      MSG91_TEMPLATES.CERTIFICATE,

    variables: {
      INTERN_NAME:
        internName,

      ROLE:
        role,

      PREVIEW_URL:
        certificateImageUrl,

      DOWNLOAD_URL:
        certificateDownloadUrl,
    },
  });
}