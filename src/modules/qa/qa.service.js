import prisma from "../../lib/prisma.js";

/* =====================================================
   🕒 IST TIMESTAMP HELPER
===================================================== */

function getISTDateTime() {
  const now = new Date();

  const istOffset =
    5.5 * 60 * 60 * 1000;

  return new Date(
    now.getTime() +
      istOffset
  );
}

/* =====================================================
   📦 GET QUESTIONS + ANSWERS
===================================================== */

export async function getQuestionsService(
  productId
) {
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
            id: true,
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
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

  if (!questions.length) {
    return [];
  }

  return questions.map(
    (question) => ({
      id: question.id,

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
        question.user?.name ||
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

  const sanitizedText =
    text.trim();

  if (
    sanitizedText.length < 3
  ) {
    throw new Error(
      "Question is too short"
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
     PREVENT DUPLICATES
  ========================= */

  const existingQuestion =
    await prisma.question.findFirst({
      where: {
        productId,
        userId,
        text:
          sanitizedText,
      },
    });

  if (existingQuestion) {
    throw new Error(
      "Duplicate question detected"
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
          sanitizedText,

        createdAt:
          getISTDateTime(),

        updatedAt:
          getISTDateTime(),
      },
    });

  return {
    id: question.id,

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
   ✏️ UPDATE QUESTION
===================================================== */

export async function updateQuestionService({
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

  const sanitizedText =
    text.trim();

  /* =========================
     FIND QUESTION
  ========================= */

  const existingQuestion =
    await prisma.question.findUnique({
      where: {
        id:
          questionId,
      },
    });

  if (!existingQuestion) {
    throw new Error(
      "Question not found"
    );
  }

  /* =========================
     OWNERSHIP VALIDATION
  ========================= */

  if (
    String(
      existingQuestion.userId
    ) !== String(userId)
  ) {
    throw new Error(
      "Unauthorized"
    );
  }

  /* =========================
     UPDATE QUESTION
  ========================= */

  const updatedQuestion =
    await prisma.question.update({
      where: {
        id:
          questionId,
      },

      data: {
        text:
          sanitizedText,

        updatedAt:
          getISTDateTime(),
      },
    });

  return updatedQuestion;
}

/* =====================================================
   ❌ DELETE QUESTION
===================================================== */

export async function deleteQuestionService({
  questionId,
  userId,
}) {
  /* =========================
     FIND QUESTION
  ========================= */

  const existingQuestion =
    await prisma.question.findUnique({
      where: {
        id:
          questionId,
      },
    });

  if (!existingQuestion) {
    throw new Error(
      "Question not found"
    );
  }

  /* =========================
     OWNERSHIP VALIDATION
  ========================= */

  if (
    String(
      existingQuestion.userId
    ) !== String(userId)
  ) {
    throw new Error(
      "Unauthorized"
    );
  }

  /* =========================
     DELETE ANSWERS FIRST
  ========================= */

  await prisma.answer.deleteMany({
    where: {
      questionId,
    },
  });

  /* =========================
     DELETE QUESTION
  ========================= */

  await prisma.question.delete({
    where: {
      id:
        questionId,
    },
  });

  return true;
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

  const sanitizedText =
    text.trim();

  if (
    sanitizedText.length < 2
  ) {
    throw new Error(
      "Answer is too short"
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
     PREVENT DUPLICATES
  ========================= */

  const existingAnswer =
    await prisma.answer.findFirst({
      where: {
        questionId,
        userId,
        text:
          sanitizedText,
      },
    });

  if (existingAnswer) {
    throw new Error(
      "Duplicate answer detected"
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
          sanitizedText,

        createdAt:
          getISTDateTime(),

        updatedAt:
          getISTDateTime(),
      },
    });

  return {
    id: answer.id,

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

/* =====================================================
   ✏️ UPDATE ANSWER
===================================================== */

export async function updateAnswerService({
  answerId,
  userId,
  text,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !answerId ||
    !userId ||
    !text
  ) {
    throw new Error(
      "Missing required fields"
    );
  }

  const sanitizedText =
    text.trim();

  /* =========================
     FIND ANSWER
  ========================= */

  const existingAnswer =
    await prisma.answer.findUnique({
      where: {
        id:
          answerId,
      },
    });

  if (!existingAnswer) {
    throw new Error(
      "Answer not found"
    );
  }

  /* =========================
     OWNERSHIP VALIDATION
  ========================= */

  if (
    String(
      existingAnswer.userId
    ) !== String(userId)
  ) {
    throw new Error(
      "Unauthorized"
    );
  }

  /* =========================
     UPDATE ANSWER
  ========================= */

  const updatedAnswer =
    await prisma.answer.update({
      where: {
        id:
          answerId,
      },

      data: {
        text:
          sanitizedText,

        updatedAt:
          getISTDateTime(),
      },
    });

  return updatedAnswer;
}

/* =====================================================
   ❌ DELETE ANSWER
===================================================== */

export async function deleteAnswerService({
  answerId,
  userId,
}) {
  /* =========================
     FIND ANSWER
  ========================= */

  const existingAnswer =
    await prisma.answer.findUnique({
      where: {
        id:
          answerId,
      },
    });

  if (!existingAnswer) {
    throw new Error(
      "Answer not found"
    );
  }

  /* =========================
     OWNERSHIP VALIDATION
  ========================= */

  if (
    String(
      existingAnswer.userId
    ) !== String(userId)
  ) {
    throw new Error(
      "Unauthorized"
    );
  }

  /* =========================
     DELETE ANSWER
  ========================= */

  await prisma.answer.delete({
    where: {
      id:
        answerId,
    },
  });

  return true;
}
