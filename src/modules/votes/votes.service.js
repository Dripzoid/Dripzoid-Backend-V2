import prisma from "../../lib/prisma.js";

/* =====================================================
   🔥 ALLOWED ENTITY TYPES
===================================================== */

const ALLOWED_ENTITY_TYPES = [
  "review",
  "question",
  "answer",
];

/* =====================================================
   🔥 ALLOWED VOTES
===================================================== */

const ALLOWED_VOTES = [
  "like",
  "dislike",
  "none",
];

/* =====================================================
   🔥 VALIDATE ENTITY EXISTS
===================================================== */

async function validateEntityExists({
  entityType,
  entityId,
}) {
  switch (entityType) {
    case "review": {
      const review =
        await prisma.review.findUnique({
          where: {
            id: entityId,
          },

          select: {
            id: true,
          },
        });

      if (!review) {
        throw new Error(
          "Review not found"
        );
      }

      break;
    }

    default:
      throw new Error(
        "Unsupported entity type"
      );
  }
}

/* =====================================================
   🔥 SUBMIT VOTE
===================================================== */

export async function submitVoteService({
  entityId,
  entityType,
  userId,
  vote,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !entityId ||
    !entityType ||
    !userId
  ) {
    throw new Error(
      "Missing required fields"
    );
  }

  if (
    !ALLOWED_ENTITY_TYPES.includes(
      entityType
    )
  ) {
    throw new Error(
      "Invalid entity type"
    );
  }

  if (
    !ALLOWED_VOTES.includes(
      vote
    )
  ) {
    throw new Error(
      "Invalid vote"
    );
  }

  /* =========================
     VALIDATE ENTITY EXISTS
  ========================= */

  await validateEntityExists({
    entityId,
    entityType,
  });

  /* =========================
     CHECK EXISTING VOTE
  ========================= */

  const existingVote =
    await prisma.vote.findFirst({
      where: {
        entityId,
        entityType,
        userId,
      },
    });

  /* =========================
     REMOVE VOTE
  ========================= */

  if (vote === "none") {
    if (existingVote) {
      await prisma.vote.delete({
        where: {
          id:
            existingVote.id,
        },
      });

      return {
        success: true,

        action:
          "removed",

        vote: "none",
      };
    }

    return {
      success: true,

      action: "noop",

      vote: "none",
    };
  }

  /* =========================
     CREATE NEW VOTE
  ========================= */

  if (!existingVote) {
    await prisma.vote.create({
      data: {
        entityId,
        entityType,
        userId,
        vote,
      },
    });

    return {
      success: true,

      action:
        "created",

      vote,
    };
  }

  /* =========================
     NO CHANGES
  ========================= */

  if (
    existingVote.vote ===
    vote
  ) {
    return {
      success: true,

      action: "noop",

      vote,
    };
  }

  /* =========================
     UPDATE VOTE
  ========================= */

  await prisma.vote.update({
    where: {
      id: existingVote.id,
    },

    data: {
      vote,
    },
  });

  return {
    success: true,

    action:
      "updated",

    vote,
  };
}

/* =====================================================
   🔥 GET VOTE COUNTS
===================================================== */

export async function getVotesService({
  entityType,
  entityIds,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !entityType ||
    !entityIds
  ) {
    return {};
  }

  if (
    !ALLOWED_ENTITY_TYPES.includes(
      entityType
    )
  ) {
    throw new Error(
      "Invalid entity type"
    );
  }

  /* =========================
     NORMALIZE IDS
  ========================= */

  const ids =
    String(entityIds)
      .split(",")
      .map((id) =>
        id.trim()
      )
      .filter(Boolean);

  if (!ids.length) {
    return {};
  }

  /* =========================
     FETCH VOTES
  ========================= */

  const votes =
    await prisma.vote.findMany({
      where: {
        entityType,

        entityId: {
          in: ids,
        },
      },

      select: {
        entityId: true,
        vote: true,
      },
    });

  /* =========================
     BUILD RESULT
  ========================= */

  const result = {};

  // initialize all ids
  ids.forEach((id) => {
    result[id] = {
      like: 0,
      dislike: 0,
      total: 0,
    };
  });

  for (const vote of votes) {
    if (
      vote.vote === "like"
    ) {
      result[
        vote.entityId
      ].like += 1;
    }

    if (
      vote.vote ===
      "dislike"
    ) {
      result[
        vote.entityId
      ].dislike += 1;
    }

    result[
      vote.entityId
    ].total += 1;
  }

  return result;
}
