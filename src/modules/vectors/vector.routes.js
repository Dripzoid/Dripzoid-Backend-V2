import express from "express";

import {
  fetchProductVectors
} from "./vector.controller.js";

const router =
  express.Router();

router.get(
  "/products",
  fetchProductVectors
);

export default router;
