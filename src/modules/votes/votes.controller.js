import {
  submitVoteService,
  getVotesService,
} from "./votes.service.js";

/* =====================================================
   🔥 SUBMIT VOTE
===================================================== */

export const submitVote =
  async (req, res) => {
    try {
      const {
        entityId,
        entityType,
        vote,
      } = req.body;

      // authenticated user
      const userId =
        req.user?.id;

      /* =========================
         VALIDATION
      ========================= */

      if (
        !entityId ||
        !entityType ||
        !vote
      ) {
        return res.status(400).json({
          success: false,
          error:
            "entityId, entityType and vote are required",
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error:
            "Unauthorized",
        });
      }

      const allowedVotes = [
        "like",
        "dislike",
        "none",
      ];

      if (
        !allowedVotes.includes(
          vote
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid vote type",
        });
      }

      const data =
        await submitVoteService({
          entityId,
          entityType,
          userId,
          vote,
        });

      return res.json({
        success: true,
        data,
      });

    } catch (err) {
      console.error(
        "submitVote error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to submit vote",
      });
    }
  };

/* =====================================================
   🔥 GET VOTES
===================================================== */

export const getVotes =
  async (req, res) => {
    try {
      const {
        entityType,
        entityIds,
      } = req.query;

      /* =========================
         VALIDATION
      ========================= */

      if (
        !entityType ||
        !entityIds
      ) {
        return res.status(400).json({
          success: false,
          error:
            "entityType and entityIds are required",
        });
      }

      const votes =
        await getVotesService({
          entityType,
          entityIds,
        });

      return res.json({
        success: true,
        votes,
      });

    } catch (err) {
      console.error(
        "getVotes error:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          err.message ||
          "Failed to fetch votes",
      });
    }
  };
