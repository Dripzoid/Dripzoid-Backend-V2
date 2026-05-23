import { UAParser } from "ua-parser-js";

export function getDevice(req) {
  try {
    const parser = new UAParser(req.headers["user-agent"]);
    const device =
      parser.getDevice().model ||
      parser.getOS().name ||
      "Unknown Device";
    const browser = parser.getBrowser().name || "";
    return `${device} ${browser}`.trim();
  } catch {
    return "Unknown Device";
  }
}

export function getIP(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return xf.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "Unknown IP";
}