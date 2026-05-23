import {
  getCouponsService,
  createCouponService,
  updateCouponService,
  deleteCouponService,
  bulkCouponActionService,
  redeemCouponService,
  getCouponAnalyticsService,
  getCouponAuditLogsService,
} from "./coupons.service.js";

/* =====================================================
   📦 GET ALL COUPONS
===================================================== */

export const getCoupons =
  async (req, res) => {
    try {
      const rows =
        await getCouponsService();

      res.json(rows);
    } catch (err) {
      console.error(
        "getCoupons error:",
        err
      );

      res.status(500).json({
        error: "db_error",
      });
    }
  };

/* =====================================================
   ➕ CREATE COUPON
===================================================== */

export const createCoupon =
  async (req, res) => {
    try {
      const result =
        await createCouponService(
          req.body
        );

      res.status(201).json(
        result
      );
    } catch (err) {
      console.error(
        "createCoupon error:",
        err
      );

      if (
        err.message ===
        "code_exists"
      ) {
        return res.status(409).json({
          error:
            "code_exists",
        });
      }

      if (
        err.message ===
        "code_required"
      ) {
        return res.status(400).json({
          error:
            "code_required",
        });
      }

      res.status(500).json({
        error: "db_error",
      });
    }
  };

/* =====================================================
   ✏️ UPDATE COUPON
===================================================== */

export const updateCoupon =
  async (req, res) => {
    try {
      await updateCouponService(
        req.params.id,
        req.body
      );

      res.json({
        ok: true,
      });
    } catch (err) {
      console.error(
        "updateCoupon error:",
        err
      );

      if (
        err.message ===
        "not_found"
      ) {
        return res.status(404).json({
          error:
            "not_found",
        });
      }

      res.status(500).json({
        error: "db_error",
      });
    }
  };

/* =====================================================
   ❌ DELETE COUPON
===================================================== */

export const deleteCoupon =
  async (req, res) => {
    try {
      await deleteCouponService(
        req.params.id
      );

      res.json({
        ok: true,
      });
    } catch (err) {
      console.error(
        "deleteCoupon error:",
        err
      );

      res.status(500).json({
        error: "db_error",
      });
    }
  };

/* =====================================================
   🔥 BULK ACTIONS
===================================================== */

export const bulkCouponAction =
  async (req, res) => {
    try {
      await bulkCouponActionService(
        req.body
      );

      res.json({
        ok: true,
      });
    } catch (err) {
      console.error(
        "bulkCouponAction error:",
        err
      );

      if (
        err.message ===
        "invalid"
      ) {
        return res.status(400).json({
          error: "invalid",
        });
      }

      res.status(500).json({
        error: "db_error",
      });
    }
  };

/* =====================================================
   🎟️ REDEEM COUPON
===================================================== */

export const redeemCoupon =
  async (req, res) => {
    try {
      const result =
        await redeemCouponService(
          req.body
        );

      res.json(result);
    } catch (err) {
      console.error(
        "redeemCoupon error:",
        err
      );

      const knownErrors = [
        "invalid_coupon",
        "usage_limit_reached",
        "min_purchase_not_met",
        "code_required",
      ];

      if (
        knownErrors.includes(
          err.message
        )
      ) {
        let status = 400;

        if (
          err.message ===
          "invalid_coupon"
        ) {
          status = 404;
        }

        if (
          err.message ===
          "usage_limit_reached"
        ) {
          status = 409;
        }

        if (
          err.message ===
          "min_purchase_not_met"
        ) {
          status = 422;
        }

        return res
          .status(status)
          .json({
            error:
              err.message,
          });
      }

      res.status(500).json({
        error:
          "redeem_failed",
      });
    }
  };

/* =====================================================
   📊 ANALYTICS
===================================================== */

export const getCouponAnalytics =
  async (req, res) => {
    try {
      const data =
        await getCouponAnalyticsService();

      res.json(data);
    } catch (err) {
      console.error(
        "getCouponAnalytics error:",
        err
      );

      res.status(500).json({
        error: "db_error",
      });
    }
  };

/* =====================================================
   📜 AUDIT LOGS
===================================================== */

export const getCouponAuditLogs =
  async (req, res) => {
    try {
      const rows =
        await getCouponAuditLogsService();

      res.json(rows);
    } catch (err) {
      console.error(
        "getCouponAuditLogs error:",
        err
      );

      res.status(500).json({
        error: "db_error",
      });
    }
  };