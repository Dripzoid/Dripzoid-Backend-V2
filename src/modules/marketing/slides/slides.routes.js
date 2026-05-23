import express from "express";

import {
  getPublicSlides,
  getAdminSlides,
  createSlide,
  updateSlide,
  deleteSlide,
} from "./slides.controller.js";

import { adminAuth }
from "../../../middlewares/admin.middleware.js";

const router = express.Router();

// 🌍 PUBLIC
router.get(
  "/public/slides",
  getPublicSlides
);

// 🔐 ADMIN
router.get(
  "/admin/slides",
  adminAuth,
  getAdminSlides
);

router.post(
  "/admin/slides",
  adminAuth,
  createSlide
);

router.put(
  "/admin/slides/:id",
  adminAuth,
  updateSlide
);

router.delete(
  "/admin/slides/:id",
  adminAuth,
  deleteSlide
);

export default router;