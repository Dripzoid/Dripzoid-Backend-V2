import express from "express";

import {
  embedText,
} from "./embedding.controller.js";

const router =
  express.Router();

router.post(
  "/",
  embedText
);

export default router;
