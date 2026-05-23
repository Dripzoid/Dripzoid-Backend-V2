import {
  submitVoteService,
  getVotesService,
} from "./votes.service.js";

// 🔥 Submit Vote
export const submitVote = async (
  req,
  res
) => {
  try {
    const {
      entityId,
      entityType,
      userId,
      vote,
    } = req.body;

    // validation
    if (
      !entityId ||
      !entityType ||
      !userId ||
      !vote
    ) {
      return res.status(400).json({
        error:
          "entityId, entityType, userId and vote are required",
      });
    }

    const allowedVotes = [
      "like",
      "dislike",
      "none",
    ];

    if (
      !allowedVotes.includes(vote)
    ) {
      return res.status(400).json({
        error: "Invalid vote type",
      });
    }

    const data =
      await submitVoteService({
        entityId,
        entityType,
        userId,
        vote,
      });

    res.json(data);
  } catch (err) {
    console.error(
      "submitVote error:",
      err
    );

    res.status(500).json({
      error:
        err.message ||
        "Failed to submit vote",
    });
  }
};

// 🔥 Get Vote Counts
export const getVotes = async (
  req,
  res
) => {
  try {
    const {
      entityType,
      entityIds,
    } = req.query;

    if (
      !entityType ||
      !entityIds
    ) {
      return res.status(400).json({
        error:
          "entityType and entityIds are required",
      });
    }

    const votes =
      await getVotesService({
        entityType,
        entityIds,
      });

    res.json({
      success: true,
      votes,
    });
  } catch (err) {
    console.error(
      "getVotes error:",
      err
    );

    res.status(500).json({
      error:
        err.message ||
        "Failed to fetch votes",
    });
  }
};