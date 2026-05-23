import { z } from "zod";

/* =====================================================
   🔒 CHANGE PASSWORD
===================================================== */

export const changePasswordSchema =
  z
    .object({
      current:
        z.string().min(1),

      newpw:
        z.string().min(8),

      confirm:
        z.string().min(8),
    })
    .refine(
      (data) =>
        data.newpw ===
        data.confirm,
      {
        message:
          "Passwords do not match",

        path: [
          "confirmPassword",
        ],
      }
    );

/* =====================================================
   🔔 NOTIFICATIONS
===================================================== */

export const notificationSchema =
  z.object({
    email:
      z.boolean().optional(),

    sms:
      z.boolean().optional(),

    push:
      z.boolean().optional(),

    marketing:
      z.boolean().optional(),

    orderUpdates:
      z.boolean().optional(),
  });