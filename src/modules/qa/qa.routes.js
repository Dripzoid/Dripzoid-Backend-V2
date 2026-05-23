import express from "express";

import {
  getQuestions,
  createQuestion,
  createAnswer,
} from "./qa.controller.js";

const router = express.Router();

/* =========================================
   📦 GET QUESTIONS + ANSWERS
========================================= */

router.get(
  "/:productId",
  getQuestions
);

/* =========================================
   ➕ CREATE QUESTION
========================================= */

router.post(
  "/",
  createQuestion
);

/* =========================================
   ➕ CREATE ANSWER
========================================= */

router.post(
  "/:questionId/answers",
  createAnswer
);

export default router;