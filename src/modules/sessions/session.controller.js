import {
  deleteSession,
  deleteAllSessions,
  getUserSessions,
} from "./session.service.js";

import { insertUserActivity } from "../../utils/activity.js";

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

// SIGNOUT CURRENT SESSION
export const signoutSession = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const sessionId = req.sessionId;

    if (!userId) {
      return res.status(400).json({ message: "Invalid user" });
    }

    if (sessionId) {
      await deleteSession(userId, sessionId);
    }

    res.clearCookie("token", AUTH_COOKIE_OPTIONS);
    res.clearCookie("sessionId", AUTH_COOKIE_OPTIONS);

    insertUserActivity(userId, "Logged Out", () => {});

    return res.json({ message: "Signed out" });
  } catch (err) {
    console.error("Signout error:", err);
    return res.status(500).json({ message: "Signout failed" });
  }
};

// LOGOUT ALL
export const logoutAll = async (req, res) => {
  try {
    const userId = Number(req.user?.id);

    await deleteAllSessions(userId);

    res.clearCookie("token", AUTH_COOKIE_OPTIONS);
    res.clearCookie("sessionId", AUTH_COOKIE_OPTIONS);

    return res.json({ message: "All sessions cleared" });
  } catch (err) {
    console.error("Logout all error:", err);
    return res.status(500).json({ message: "Failed to logout all" });
  }
};

// GET SESSIONS
export const getSessions = async (req, res) => {
  try {
    const userId = Number(req.user?.id);

    const sessions = await getUserSessions(userId);

    return res.json({
      success: true,
      data: sessions,
    });
  } catch (err) {
    console.error("Sessions error:", err);
    return res.status(500).json({ message: "Failed to fetch sessions" });
  }
};

// DELETE SESSION
export const revokeSession = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const sessionId = Number(req.params.id);

    await deleteSession(userId, sessionId);

    return res.json({
      success: true,
      message: "Session revoked",
    });
  } catch (err) {
    console.error("Delete session error:", err);
    return res.status(500).json({ message: "Failed to delete session" });
  }
};