import express from "express";

import {
  submitVote,
  getVotes,
} from "./votes.controller.js";

const router = express.Router();

/* =========================================
   🔥 SUBMIT VOTE
========================================= */

router.post(
  "/",
  submitVote
);

/* =========================================
   🔥 GET VOTES
========================================= */

router.get(
  "/",
  getVotes
);

export default router;