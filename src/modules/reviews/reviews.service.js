import prisma from "../../lib/prisma.js";

/* =====================================================
🔄 RECALCULATE PRODUCT RATING
===================================================== */

async function recalculateProductRating(productId) {
  const aggregate = await prisma.review.aggregate({
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
      rating: Number(
        aggregate._avg.rating || 0
      ),
    },
  });
}

/* =====================================================
📦 GET PRODUCT REVIEWS
===================================================== */

export async function getProductReviewsService(
  productId
) {
  const reviews = await prisma.review.findMany({
    where: {
      productId,
    },

    orderBy: {
      createdAt: "desc",
    },

    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },

      votes: true,
    },
  });

  return reviews.map((review) => ({
    id: review.id,

    productId: review.productId,

    userId: review.userId,

    rating: review.rating,

    text: review.text,

    imageUrl: review.imageUrl,

    createdAt: review.createdAt,

    /*
     * IMPORTANT:
     * Do NOT return review.updatedAt because
     * the Prisma Review model does not contain
     * an updatedAt field.
     */

    userName:
      review.user?.name || "Unknown User",

    likes: review.votes.filter(
      (vote) => vote.vote === "like"
    ).length,

    dislikes: review.votes.filter(
      (vote) => vote.vote === "dislike"
    ).length,
  }));
}

/* =====================================================
📦 GET SINGLE REVIEW
===================================================== */

export async function getReviewByIdService(id) {
  const review = await prisma.review.findUnique({
    where: {
      id,
    },

    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },

      votes: true,
    },
  });

  if (!review) {
    throw new Error("Review not found");
  }

  return {
    id: review.id,

    productId: review.productId,

    userId: review.userId,

    rating: review.rating,

    text: review.text,

    imageUrl: review.imageUrl,

    createdAt: review.createdAt,

    /*
     * IMPORTANT:
     * No updatedAt because it does not exist
     * in the Prisma Review model.
     */

    userName:
      review.user?.name || "Unknown User",

    likes: review.votes.filter(
      (vote) => vote.vote === "like"
    ).length,

    dislikes: review.votes.filter(
      (vote) => vote.vote === "dislike"
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

  if (!productId || !userId || !rating) {
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
  PREVENT DUPLICATE REVIEW
  ========================= */

  const existingReview =
    await prisma.review.findFirst({
      where: {
        productId,
        userId,
      },
    });

  if (existingReview) {
    throw new Error(
      "You already reviewed this product"
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

        rating: Number(rating),

        text:
          text?.trim() || "",

        imageUrl:
          imageUrl || null,

        /*
         * Review model supports createdAt.
         *
         * DO NOT ADD updatedAt.
         */
        createdAt:
          new Date(),
      },
    });

  /* =========================
  UPDATE PRODUCT RATING
  ========================= */

  await recalculateProductRating(
    productId
  );

  return {
    id: review.id,

    createdAt:
      review.createdAt,
  };
}

/* =====================================================
✏️ UPDATE REVIEW
===================================================== */

export async function updateReviewService({
  reviewId,
  userId,
  rating,
  text,
  imageUrl,
}) {
  /* =========================
  FIND REVIEW
  ========================= */

  const existingReview =
    await prisma.review.findUnique({
      where: {
        id: reviewId,
      },
    });

  if (!existingReview) {
    throw new Error(
      "Review not found"
    );
  }

  /* =========================
  OWNERSHIP VALIDATION
  ========================= */

  if (
    String(existingReview.userId) !==
    String(userId)
  ) {
    throw new Error(
      "Unauthorized"
    );
  }

  /* =========================
  UPDATE REVIEW
  ========================= */

  const updateData = {};

  if (rating !== undefined) {
    updateData.rating =
      Number(rating);
  }

  if (text !== undefined) {
    updateData.text =
      text?.trim() || "";
  }

  if (imageUrl !== undefined) {
    updateData.imageUrl =
      imageUrl || null;
  }

  /*
   * IMPORTANT:
   * DO NOT include:
   *
   * updatedAt: getISTDateTime()
   *
   * because updatedAt does not exist
   * in the Prisma Review model.
   */

  const updatedReview =
    await prisma.review.update({
      where: {
        id: reviewId,
      },

      data: updateData,
    });

  /* =========================
  RECALCULATE PRODUCT RATING
  ========================= */

  await recalculateProductRating(
    existingReview.productId
  );

  return updatedReview;
}

/* =====================================================
❌ DELETE REVIEW
===================================================== */

export async function deleteReviewService({
  reviewId,
  userId,
}) {
  /* =========================
  FIND REVIEW
  ========================= */

  const existingReview =
    await prisma.review.findUnique({
      where: {
        id: reviewId,
      },
    });

  if (!existingReview) {
    throw new Error(
      "Review not found"
    );
  }

  /* =========================
  OWNERSHIP VALIDATION
  ========================= */

  if (
    String(existingReview.userId) !==
    String(userId)
  ) {
    throw new Error(
      "Unauthorized"
    );
  }

  const productId =
    existingReview.productId;

  /* =========================
  DELETE REVIEW
  ========================= */

  await prisma.review.delete({
    where: {
      id: reviewId,
    },
  });

  /* =========================
  RECALCULATE PRODUCT RATING
  ========================= */

  await recalculateProductRating(
    productId
  );

  return true;
}
