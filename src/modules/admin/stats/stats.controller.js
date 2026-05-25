// modules/admin/stats/stats.controller.js

import {
  getAdminStatsService,
} from "./stats.service.js";

/* ==================================================
   GET ADMIN STATS
================================================== */

export const getAdminStats =
  async (req, res) => {
    try {
      const {
        date,
        week,
        month,
      } = req.query;

      const stats =
        await getAdminStatsService({
          date,
          week,
          month,
        });

      return res.json(stats);
    } catch (error) {
      console.error(
        "Admin stats error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to fetch stats",
      });
    }
  };
