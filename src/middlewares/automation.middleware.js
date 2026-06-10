// src/middlewares/automation.middleware.js

export function verifyInternalKey(
  req,
  res,
  next
) {
  const internalKey =
    req.headers["x-internal-key"];

  if (
    !internalKey ||
    internalKey !== process.env.AUTOMATION_API_KEY
  ) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  next();
}
