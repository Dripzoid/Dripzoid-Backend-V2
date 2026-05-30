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
      return res.status(401)
        .json({
          success: false,
          message:
            "Unauthorized Internal Request",
        });
    }

    next();
  };
