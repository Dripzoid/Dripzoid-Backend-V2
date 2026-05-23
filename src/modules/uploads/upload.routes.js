import express from "express";

import { upload }
from "../../middlewares/upload.middleware.js";

import { uploadImage }
from "./upload.controller.js";

import { adminAuth }
from "../../middlewares/admin.middleware.js";

const router = express.Router();

// ☁️ Upload image
router.post(
  "/admin/upload/image",
  adminAuth,
  upload.single("image"),
  uploadImage
);

export default router;