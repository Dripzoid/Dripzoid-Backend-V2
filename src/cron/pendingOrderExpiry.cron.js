// src/cron/pendingOrderExpiry.cron.js
import cron from "node-cron";
import { expirePendingOrdersOlderThan } from "../modules/payments/payment.repository.js";

export function startPendingOrderExpiryCron() {
  cron.schedule(
    "*/5 * * * *",
    async () => {
      try {
        const result = await expirePendingOrdersOlderThan(30);
        const count = result?.count ?? result?.data?.count ?? 0;

        if (count > 0) {
          console.log(`[cron] Expired ${count} pending order(s) older than 30 minutes.`);
        }
      } catch (error) {
        console.error("[cron] Pending order expiry failed:", error);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
}
