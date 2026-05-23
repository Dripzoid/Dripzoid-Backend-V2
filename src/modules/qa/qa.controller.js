import {
  getQuestionsService,
  createQuestionService,
  createAnswerService,
} from "./qa.service.js";

// 📦 GET QUESTIONS + ANSWERS
export const getQuestions =
  async (req, res) => {
    try {
      const data =
        await getQuestionsService(
          req.params.productId
        );

      res.json({
        questions: data,
      });
    } catch (err) {
      console.error(
        "getQuestions error:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to fetch questions",
      });
    }
  };

// ➕ CREATE QUESTION
export const createQuestion =
  async (req, res) => {
    try {
      const {
        productId,
        userId,
        text,
      } = req.body;

      // validation
      if (
        !productId ||
        !userId ||
        !text
      ) {
        return res.status(400).json({
          error:
            "productId, userId and text are required",
        });
      }

      const data =
        await createQuestionService({
          productId,
          userId,
          text,
        });

      res.status(201).json(data);
    } catch (err) {
      console.error(
        "createQuestion error:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to create question",
      });
    }
  };

// ➕ CREATE ANSWER
export const createAnswer =
  async (req, res) => {
    try {
      const {
        userId,
        text,
      } = req.body;

      const { questionId } =
        req.params;

      // validation
      if (
        !questionId ||
        !userId ||
        !text
      ) {
        return res.status(400).json({
          error:
            "questionId, userId and text are required",
        });
      }

      const data =
        await createAnswerService({
          questionId,
          userId,
          text,
        });

      res.status(201).json(data);
    } catch (err) {
      console.error(
        "createAnswer error:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to create answer",
      });
    }
  };