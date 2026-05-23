import prisma from "../../lib/prisma.js";

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

  const allowedVotes =
    [
      "like",
      "dislike",
      "none",
    ];

  if (
    !allowedVotes.includes(
      vote
    )
  ) {
    throw new Error(
      "Invalid vote"
    );
  }

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
     INSERT VOTE
  ========================= */

  if (
    !existingVote &&
    vote !== "none"
  ) {
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
        "inserted",
    };
  }

  /* =========================
     REMOVE VOTE
  ========================= */

  if (
    existingVote &&
    vote === "none"
  ) {
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
    };
  }

  /* =========================
     UPDATE VOTE
  ========================= */

  if (
    existingVote &&
    existingVote.vote !==
      vote
  ) {
    await prisma.vote.update({
      where: {
        id:
          existingVote.id,
      },

      data: {
        vote,
      },
    });

    return {
      success: true,

      action:
        "updated",
    };
  }

  /* =========================
     NO CHANGES
  ========================= */

  return {
    success: true,

    action: "noop",
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

  votes.forEach((vote) => {
    if (
      !result[
        vote.entityId
      ]
    ) {
      result[
        vote.entityId
      ] = {
        like: 0,
        dislike: 0,
      };
    }

    if (
      vote.vote ===
      "like"
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
  });

  return result;
}