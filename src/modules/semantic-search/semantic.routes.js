import express from "express";

import {
  embedText,
  searchProducts,
} from "./semantic.controller.js";

const router = express.Router();

router.post("/", embedText);
router.get("/search", searchProducts);
router.post("/search", searchProducts);

export default router;
