import {
  getQuestionsService,
  createQuestionService,
  createAnswerService,
  updateQuestionService,
  deleteQuestionService,
  updateAnswerService,
  deleteAnswerService,
} from "./qa.service.js";

/* =====================================================
   📦 GET QUESTIONS + ANSWERS
===================================================== */

export const getQuestions =
  async (req, res) => {
    try {
      const data =
        await getQuestionsService(
          req.params.productId
        );

      return res.json({
        success: true,
        questions: data,
      });

    } catch (err) {
      console.error(
        "getQuestions error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to fetch questions",
      });
    }
  };

/* =====================================================
   ➕ CREATE QUESTION
===================================================== */

export const createQuestion =
  async (req, res) => {
    try {
      const {
        productId,
        text,
      } = req.body;

      // authenticated user
      const userId =
        req.user?.id;

      /* =========================
         VALIDATION
      ========================= */

      if (
        !productId ||
        !text
      ) {
        return res.status(400).json({
          success: false,
          error:
            "productId and text are required",
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error:
            "Unauthorized",
        });
      }

      const data =
        await createQuestionService({
          productId,
          userId,
          text,
        });

      return res.status(201).json({
        success: true,
        data,
      });

    } catch (err) {
      console.error(
        "createQuestion error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to create question",
      });
    }
  };

/* =====================================================
   ✏️ UPDATE QUESTION
===================================================== */

export const updateQuestion =
  async (req, res) => {
    try {
      const {
        text,
      } = req.body;

      const {
        questionId,
      } = req.params;

      const userId =
        req.user?.id;

      /* =========================
         VALIDATION
      ========================= */

      if (
        !questionId ||
        !text
      ) {
        return res.status(400).json({
          success: false,
          error:
            "questionId and text are required",
        });
      }

      const data =
        await updateQuestionService({
          questionId,
          userId,
          text,
        });

      return res.json({
        success: true,
        data,
      });

    } catch (err) {
      console.error(
        "updateQuestion error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to update question",
      });
    }
  };

/* =====================================================
   ❌ DELETE QUESTION
===================================================== */

export const deleteQuestion =
  async (req, res) => {
    try {
      const {
        questionId,
      } = req.params;

      const userId =
        req.user?.id;

      await deleteQuestionService({
        questionId,
        userId,
      });

      return res.json({
        success: true,
        message:
          "Question deleted successfully",
      });

    } catch (err) {
      console.error(
        "deleteQuestion error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to delete question",
      });
    }
  };

/* =====================================================
   ➕ CREATE ANSWER
===================================================== */

export const createAnswer =
  async (req, res) => {
    try {
      const {
        text,
      } = req.body;

      const {
        questionId,
      } = req.params;

      // authenticated user
      const userId =
        req.user?.id;

      /* =========================
         VALIDATION
      ========================= */

      if (
        !questionId ||
        !text
      ) {
        return res.status(400).json({
          success: false,
          error:
            "questionId and text are required",
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error:
            "Unauthorized",
        });
      }

      const data =
        await createAnswerService({
          questionId,
          userId,
          text,
        });

      return res.status(201).json({
        success: true,
        data,
      });

    } catch (err) {
      console.error(
        "createAnswer error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to create answer",
      });
    }
  };

/* =====================================================
   ✏️ UPDATE ANSWER
===================================================== */

export const updateAnswer =
  async (req, res) => {
    try {
      const {
        text,
      } = req.body;

      const {
        answerId,
      } = req.params;

      const userId =
        req.user?.id;

      /* =========================
         VALIDATION
      ========================= */

      if (
        !answerId ||
        !text
      ) {
        return res.status(400).json({
          success: false,
          error:
            "answerId and text are required",
        });
      }

      const data =
        await updateAnswerService({
          answerId,
          userId,
          text,
        });

      return res.json({
        success: true,
        data,
      });

    } catch (err) {
      console.error(
        "updateAnswer error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to update answer",
      });
    }
  };

/* =====================================================
   ❌ DELETE ANSWER
===================================================== */

export const deleteAnswer =
  async (req, res) => {
    try {
      const {
        answerId,
      } = req.params;

      const userId =
        req.user?.id;

      await deleteAnswerService({
        answerId,
        userId,
      });

      return res.json({
        success: true,
        message:
          "Answer deleted successfully",
      });

    } catch (err) {
      console.error(
        "deleteAnswer error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to delete answer",
      });
    }
  };
