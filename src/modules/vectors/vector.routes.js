import express from "express";

import {
  fetchProductVectors,
  fetchKBVectors
} from "./vector.controller.js";

const router =
  express.Router();

router.get(
  "/products",
  fetchProductVectors
);
router.get(
  "/kb",
  fetchKBVectors
);

export default router;
