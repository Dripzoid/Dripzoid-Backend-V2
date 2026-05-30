export const verifyInternalApi =
  (req, res, next) => {

    const apiKey =
      req.headers["x-internal-key"];

    if (
      apiKey !==
      process.env.ASKDRIP_INTERNAL_KEY
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    req.internalUserId =
      req.headers["x-user-id"];

    next();
  };
