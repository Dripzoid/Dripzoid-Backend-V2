export const verifyInternalApi =
  (req, res, next) => {

    const apiKey =
      req.headers[
        "x-internal-key"
      ];

    if (
      !apiKey ||
      apiKey !==
        process.env
          .ASKDRIP_INTERNAL_KEY
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Unauthorized Internal Request",
      });
    }

    const userId =
      req.headers[
        "x-user-id"
      ];

    if (!userId) {
      return res.status(400).json({
        success: false,
        message:
          "X-User-Id header is required",
      });
    }

    req.internalUserId =
      userId;

    next();
  };
