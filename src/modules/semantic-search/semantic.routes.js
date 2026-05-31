import express from "express";

import {
  searchProducts,
} from "./semantic.controller.js";

const router =
  express.Router();

router.post(
  "/products/search",
  searchProducts
);

export default router;
