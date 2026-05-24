import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

// 🔐 Main Auth Middleware
export function authenticateToken(req, res, next) {
  try {
    console.log(
      req.headers.authorization
    );
    let token = null;

    // Authorization header
    const authHeader =
      req.headers["authorization"] ||
      req.headers["Authorization"];

    if (
      authHeader &&
      authHeader.toLowerCase().startsWith("bearer ")
    ) {
      token = authHeader.split(" ")[1];
    }

    // Fallback to cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    req.user = payload;
    req.token = token;
    req.sessionId =
      payload?.sessionId ||
      req.cookies?.sessionId ||
      null;

    next();
  } catch (err) {
    console.error("authenticateToken error:", err);

    if (err.name === "TokenExpiredError") {
      return res.status(403).json({
        message: "Token expired",
      });
    }

    return res.status(403).json({
      message: "Invalid token",
    });
  }
}
