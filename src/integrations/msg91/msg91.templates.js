export const MSG91_TEMPLATES = {

  OTP:
    process.env
      .MSG91_EMAIL_TEMPLATE,

  CERTIFICATE:
    process.env
      .MSG91_CERTIFICATE_TEMPLATE,

  ORDER_CONFIRMATION:
    process.env
      .MSG91_ORDER_TEMPLATE,
};