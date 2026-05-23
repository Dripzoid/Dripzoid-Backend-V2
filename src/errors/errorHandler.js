export function errorHandler(
  err,
  req,
  res,
  next
) {
  console.error("❌ ERROR:", {
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    details: err.details,
    stack: err.stack,
  });

  return res.status(
    err.statusCode || 500
  ).json({
    success: false,

    message:
      err.message ||
      "Internal Server Error",

    ...(process.env.NODE_ENV ===
    "development"
      ? {
          details: err.details,
          stack: err.stack,
        }
      : {}),
  });
}