import axios from "axios";

import {
  IntegrationError,
} from "../../errors/IntegrationError.js";

const MSG91_AUTHKEY =
  process.env.MSG91_AUTHKEY;

const EMAIL_API =
  "https://control.msg91.com/api/v5/email/send";

/* =====================================================
   🌐 BASE MSG91 EMAIL REQUEST
===================================================== */

async function sendMSG91Request(
  payload
) {

  try {

    const response =
      await axios.post(
        EMAIL_API,
        payload,
        {
          headers: {
            authkey:
              MSG91_AUTHKEY,

            "Content-Type":
              "application/json",
          },

          timeout: 15000,
        }
      );

    return response.data;

  } catch (err) {

    console.error(
      "MSG91 Error:",
      err?.response?.data ||
        err.message
    );

    throw new IntegrationError(
      "MSG91 request failed",

      err?.response?.data ||
        err.message
    );
  }
}

/* =====================================================
   📧 GENERIC EMAIL
===================================================== */

export async function sendMSG91Email({
  to,
  templateId,
  variables = {},
  fromEmail =
    "careers@dripzoid.com",
  fromName =
    "Dripzoid Development Team",
}) {

  return sendMSG91Request({
    to: [
      {
        email: to,
      },
    ],

    from: {
      email:
        fromEmail,

      name:
        fromName,
    },

    template_id:
      templateId,

    variables,
  });
}

/* =====================================================
   🔐 SEND OTP EMAIL
===================================================== */

export async function sendOTPEmail({
  email,
  otp,
}) {

  return sendMSG91Request({
    from: {
      email:
        process.env
          .MSG91_EMAIL_SENDER,
    },

    domain:
      process.env
        .MSG91_DOMAIN,

    template_id:
      process.env
        .MSG91_EMAIL_TEMPLATE,

    recipients: [
      {
        to: [
          {
            email,
          },
        ],

        variables: {
          otp_code:
            otp,

          logo_url:
            process.env
              .MSG91_LOGO_URL,
        },
      },
    ],
  });
}