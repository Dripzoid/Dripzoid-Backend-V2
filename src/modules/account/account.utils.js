import { UAParser } from "ua-parser-js";

/* =====================================================
   📱 PARSE DEVICE
===================================================== */

export function parseDevice(
  userAgent
) {
  try {
    const parser =
      new UAParser(
        userAgent || ""
      );

    const device =
      parser.getDevice()
        .model;

    const os =
      parser.getOS().name;

    const browser =
      parser.getBrowser()
        .name;

    return (
      device ||
      os ||
      "Unknown Device"
    ) +
      (browser
        ? ` — ${browser}`
        : "");
  } catch {
    return "Unknown Device";
  }
}

/* =====================================================
   🌐 GET IP
===================================================== */

export function getIP(req) {
  const xff =
    req.headers[
      "x-forwarded-for"
    ];

  if (xff) {
    return xff
      .split(",")[0]
      .trim();
  }

  return (
    req.ip ||
    req.connection
      ?.remoteAddress ||
    "Unknown IP"
  );
}