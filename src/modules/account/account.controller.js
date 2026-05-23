import {
  changePasswordSchema,
  notificationSchema,
} from "./account.validation.js";

import {
  changePassword,
  deleteAccount,
  exportAccountData,
  getAccountActivity,
  getAccountSettings,
  toggle2FA,
  updateNotifications,
} from "./account.service.js";

/* =====================================================
   📦 SETTINGS
===================================================== */

export async function getSettings(
  req,
  res,
  next
) {
  try {
    const data =
      await getAccountSettings(
        req.user.id
      );

    if (!data) {
      return res
        .status(404)
        .json({
          error:
            "User not found",
        });
    }

    return res.json(data);
  } catch (err) {
    next(err);
  }
}

/* =====================================================
   📜 ACTIVITY
===================================================== */

export async function getActivityController(
  req,
  res,
  next
) {
  try {
    const activity =
      await getAccountActivity(
        req.user.id
      );

    return res.json(activity);
  } catch (err) {
    next(err);
  }
}

/* =====================================================
   🔒 PASSWORD
===================================================== */

export async function updatePassword(
  req,
  res,
  next
) {
  try {
    const validated =
      changePasswordSchema.parse(
        req.body
      );

    const result =
      await changePassword(
        req.user.id,
        validated.current,
        validated.newpw
      );

    if (result.error) {
      return res
        .status(400)
        .json(result);
    }

    return res.json({
      success: true,
      message:
        "Password Updated",
    });
  } catch (err) {
    next(err);
  }
}

/* =====================================================
   🔐 2FA
===================================================== */

export async function toggle2FAController(
  req,
  res,
  next
) {
  try {
    const security =
      await toggle2FA(
        req.user.id
      );

    return res.json({
      twoFA:
        security.twoFAEnabled,

      backupCodes:
        security.backupCodes,
    });
  } catch (err) {
    next(err);
  }
}

/* =====================================================
   🔔 NOTIFICATIONS
===================================================== */

export async function updateNotificationController(
  req,
  res,
  next
) {
  try {
    const validated =
      notificationSchema.parse(
        req.body
      );

    await updateNotifications(
      req.user.id,
      validated
    );

    return res.json({
      success: true,
    });
  } catch (err) {
    next(err);
  }
}

/* =====================================================
   📤 EXPORT
===================================================== */

export async function exportController(
  req,
  res,
  next
) {
  try {
    const data =
      await exportAccountData(
        req.user.id
      );

    return res.json(data);
  } catch (err) {
    next(err);
  }
}

/* =====================================================
   ❌ DELETE
===================================================== */

export async function deleteController(
  req,
  res,
  next
) {
  try {
    await deleteAccount(
      req.user.id
    );

    return res.json({
      success: true,
      message:
        "Account deleted",
    });
  } catch (err) {
    next(err);
  }
}