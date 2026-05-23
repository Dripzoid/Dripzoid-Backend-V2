import prisma from "../../lib/prisma.js";

/* =====================================================
   🕒 IST TIMESTAMP HELPER
===================================================== */

function getISTDateTime() {
  const now =
    new Date();

  const istOffset =
    5.5 *
    60 *
    60 *
    1000;

  return new Date(
    now.getTime() +
      istOffset
  );
}

/* =====================================================
   📦 GET PRODUCT REVIEWS
===================================================== */

export async function getProductReviewsService(
  productId
) {
  /* =========================
     FETCH REVIEWS
  ========================= */

  const reviews =
    await prisma.review.findMany({
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

        votes: true,
      },
    });

  /* =========================
     FORMAT RESPONSE
  ========================= */

  return reviews.map(
    (review) => ({
      id:
        review.id,

      productId:
        review.productId,

      userId:
        review.userId,

      rating:
        review.rating,

      text:
        review.text,

      imageUrl:
        review.imageUrl,

      createdAt:
        review.createdAt,

      updatedAt:
        review.updatedAt,

      userName:
        review.user
          ?.name ||
        "Unknown User",

      likes:
        review.votes.filter(
          (vote) =>
            vote.vote ===
            "like"
        ).length,

      dislikes:
        review.votes.filter(
          (vote) =>
            vote.vote ===
            "dislike"
        ).length,
    })
  );
}

/* =====================================================
   📦 GET SINGLE REVIEW
===================================================== */

export async function getReviewByIdService(
  id
) {
  const review =
    await prisma.review.findUnique({
      where: {
        id,
      },

      include: {
        user: {
          select: {
            name: true,
          },
        },

        votes: true,
      },
    });

  if (!review) {
    throw new Error(
      "Review not found"
    );
  }

  /* =========================
     FORMAT RESPONSE
  ========================= */

  return {
    id:
      review.id,

    productId:
      review.productId,

    userId:
      review.userId,

    rating:
      review.rating,

    text:
      review.text,

    imageUrl:
      review.imageUrl,

    createdAt:
      review.createdAt,

    updatedAt:
      review.updatedAt,

    userName:
      review.user
        ?.name ||
      "Unknown User",

    likes:
      review.votes.filter(
        (vote) =>
          vote.vote ===
          "like"
      ).length,

    dislikes:
      review.votes.filter(
        (vote) =>
          vote.vote ===
          "dislike"
      ).length,
  };
}

/* =====================================================
   ➕ CREATE REVIEW
===================================================== */

export async function createReviewService({
  productId,
  userId,
  rating,
  text,
  imageUrl,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !productId ||
    !userId ||
    !rating
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
     CREATE REVIEW
  ========================= */

  const review =
    await prisma.review.create({
      data: {
        productId,

        userId,

        rating:
          Number(
            rating
          ),

        text:
          text?.trim() ||
          "",

        imageUrl:
          imageUrl ||
          null,

        createdAt:
          getISTDateTime(),
      },
    });

  /* =========================
     UPDATE PRODUCT RATING
  ========================= */

  const aggregate =
    await prisma.review.aggregate({
      where: {
        productId,
      },

      _avg: {
        rating: true,
      },
    });

  await prisma.product.update({
    where: {
      id: productId,
    },

    data: {
      rating:
        Number(
          aggregate._avg
            .rating || 0
        ),
    },
  });

  return {
    id:
      review.id,

    createdAt:
      review.createdAt,
  };
}

/* =====================================================
   ❌ DELETE REVIEW
===================================================== */

export async function deleteReviewService(
  id
) {
  /* =========================
     CHECK REVIEW
  ========================= */

  const existingReview =
    await prisma.review.findUnique({
      where: {
        id,
      },
    });

  if (
    !existingReview
  ) {
    throw new Error(
      "Review not found"
    );
  }

  const productId =
    existingReview.productId;

  /* =========================
     DELETE REVIEW
  ========================= */

  await prisma.review.delete({
    where: {
      id,
    },
  });

  /* =========================
     RECALCULATE RATING
  ========================= */

  const aggregate =
    await prisma.review.aggregate({
      where: {
        productId,
      },

      _avg: {
        rating: true,
      },
    });

  await prisma.product.update({
    where: {
      id: productId,
    },

    data: {
      rating:
        Number(
          aggregate._avg
            .rating || 0
        ),
    },
  });

  return true;
}