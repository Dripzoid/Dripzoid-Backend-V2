import { authenticateToken } from "./auth.middleware.js";

// 🔐 Admin Middleware
export function requireAdmin(req, res, next) {
  try {
    console.log("AUTH MIDDLEWARE RUNNING");
    console.log("USER:", req.user);
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!req.user.isAdmin) {
      return res.status(403).json({
        message: "Access denied: Admins only",
      });
    }

    next();
  } catch (err) {
    console.error("requireAdmin error:", err);

    return res.status(500).json({
      message: "Authorization error",
    });
  }
}

// ✅ Combined middleware helper
export const adminAuth = [
  authenticateToken,
  requireAdmin,
];
