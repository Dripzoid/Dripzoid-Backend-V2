// src/cron/pendingOrderExpiry.cron.js

import cron from "node-cron";
import { expirePendingOrdersOlderThan } from "../modules/payments/payment.repository.js";

/* =====================================================
   ⏳ EXPIRE PENDING ORDERS
   Pending -> Expired after 30 minutes
===================================================== */

export function startPendingOrderExpiryCron() {
  console.log(
    "🕒 Pending Order Expiry Cron Started"
  );

  cron.schedule(
    "*/5 * * * *", // Every 5 minutes

    async () => {
      try {
        console.log(
          "[cron] Checking pending orders..."
        );

        const result =
          await expirePendingOrdersOlderThan(
            30
          );

        const count =
          result?.count || 0;

        if (count > 0) {
          console.log(
            `[cron] Expired ${count} pending order(s)`
          );
        } else {
          console.log(
            "[cron] No pending orders to expire"
          );
        }
      } catch (error) {
        console.error(
          "[cron] Pending order expiry failed:",
          error
        );
      }
    },

    {
      timezone:
        "Asia/Kolkata",
    }
  );
}
