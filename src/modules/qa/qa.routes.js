import express from "express";

import {
  getQuestions,
  createQuestion,
  createAnswer,
  updateQuestion,
  deleteQuestion,
  updateAnswer,
  deleteAnswer,
} from "./qa.controller.js";

import {
  authenticateToken,
} from "../../middlewares/auth.middleware.js";

const router =
  express.Router();

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
  authenticateToken,
  createQuestion
);

/* =========================================
   ✏️ UPDATE QUESTION
========================================= */

router.put(
  "/:questionId",
  authenticateToken,
  updateQuestion
);

/* =========================================
   ❌ DELETE QUESTION
========================================= */

router.delete(
  "/:questionId",
  authenticateToken,
  deleteQuestion
);

/* =========================================
   ➕ CREATE ANSWER
========================================= */

router.post(
  "/:questionId/answers",
  authenticateToken,
  createAnswer
);

/* =========================================
   ✏️ UPDATE ANSWER
========================================= */

router.put(
  "/answers/:answerId",
  authenticateToken,
  updateAnswer
);

/* =========================================
   ❌ DELETE ANSWER
========================================= */

router.delete(
  "/answers/:answerId",
  authenticateToken,
  deleteAnswer
);

export default router;
