import prisma from "../../lib/prisma.js";

/* =====================================================
   📦 GET QUESTIONS + ANSWERS
===================================================== */

export async function getQuestionsService(
  productId
) {
  /* =========================
     FETCH QUESTIONS
  ========================= */

  const questions =
    await prisma.question.findMany({
      where: {
        productId,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      include: {
        user: {
          select: {
            name: true,
          },
        },

        answers: {
          orderBy: {
            createdAt:
              "asc",
          },

          include: {
            user: {
              select: {
                name: true,
              },
            },

            votes: true,
          },
        },
      },
    });

  if (
    !questions.length
  ) {
    return [];
  }

  /* =========================
     FORMAT RESPONSE
  ========================= */

  return questions.map(
    (question) => ({
      id:
        question.id,

      productId:
        question.productId,

      userId:
        question.userId,

      text:
        question.text,

      createdAt:
        question.createdAt,

      updatedAt:
        question.updatedAt,

      userName:
        question.user
          ?.name ||
        "Unknown User",

      answers:
        question.answers.map(
          (answer) => ({
            id:
              answer.id,

            questionId:
              answer.questionId,

            userId:
              answer.userId,

            text:
              answer.text,

            createdAt:
              answer.createdAt,

            updatedAt:
              answer.updatedAt,

            userName:
              answer.user
                ?.name ||
              "Unknown User",

            likes:
              answer.votes.filter(
                (
                  vote
                ) =>
                  vote.vote ===
                  "like"
              ).length,

            dislikes:
              answer.votes.filter(
                (
                  vote
                ) =>
                  vote.vote ===
                  "dislike"
              ).length,
          })
        ),
    })
  );
}

/* =====================================================
   ➕ CREATE QUESTION
===================================================== */

export async function createQuestionService({
  productId,
  userId,
  text,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !productId ||
    !userId ||
    !text
  ) {
    throw new Error(
      "Missing required fields"
    );
  }

  /* =========================
     CHECK PRODUCT
  ========================= */

  const product =
    await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

  if (!product) {
    throw new Error(
      "Product not found"
    );
  }

  /* =========================
     CREATE QUESTION
  ========================= */

  const question =
    await prisma.question.create({
      data: {
        productId,

        userId,

        text:
          text.trim(),
      },
    });

  return {
    id:
      question.id,

    productId:
      question.productId,

    userId:
      question.userId,

    text:
      question.text,

    createdAt:
      question.createdAt,
  };
}

/* =====================================================
   ➕ CREATE ANSWER
===================================================== */

export async function createAnswerService({
  questionId,
  userId,
  text,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !questionId ||
    !userId ||
    !text
  ) {
    throw new Error(
      "Missing required fields"
    );
  }

  /* =========================
     CHECK QUESTION
  ========================= */

  const question =
    await prisma.question.findUnique({
      where: {
        id:
          questionId,
      },
    });

  if (!question) {
    throw new Error(
      "Question not found"
    );
  }

  /* =========================
     CREATE ANSWER
  ========================= */

  const answer =
    await prisma.answer.create({
      data: {
        questionId,

        userId,

        text:
          text.trim(),
      },
    });

  return {
    id:
      answer.id,

    questionId:
      answer.questionId,

    userId:
      answer.userId,

    text:
      answer.text,

    createdAt:
      answer.createdAt,
  };
}