import bcrypt from "bcryptjs";

import prisma from "../../lib/prisma.js";

import { logActivity }
  from "./account.activity.js";

/* =====================================================
   📦 SETTINGS
===================================================== */

export async function getAccountSettings(
  userId
) {
  const [
    user,
    security,
    notifications,
    sessions,
    activity,
  ] =
    await prisma.$transaction([
      prisma.user.findUnique({
        where: { id: userId },

        select: {
          email: true,
          name: true,
        },
      }),

      prisma.userSecurity.findUnique(
        {
          where: { userId },
        }
      ),

      prisma.userNotification.findUnique(
        {
          where: { userId },
        }
      ),

      prisma.userSession.findMany({
        where: { userId },

        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.userActivity.findMany(
        {
          where: { userId },

          orderBy: {
            createdAt: "desc",
          },

          select: {
            id: true,
            action: true,
            createdAt: true,
          },
        }
      ),
    ]);

  if (!user) {
    return null;
  }

  return {
    user,

    security:
      security || {
        twoFAEnabled:
          false,

        backupCodes: [],
      },

    notifications:
      notifications || {
        email: true,
        sms: false,
        push: true,
        marketing: false,
        orderUpdates: true,
      },

    sessions,
    activity,
  };
}

/* =====================================================
   🔒 CHANGE PASSWORD
===================================================== */

export async function changePassword(
  userId,
  current,
  newpw
) {
  const user =
    await prisma.user.findUnique(
      {
        where: { id: userId },
      }
    );

  if (!user) {
    return {
      error:
        "User not found",
    };
  }

  const valid =
    await bcrypt.compare(
      current,
      user.password
    );

  if (!valid) {
    return {
      error:
        "Current password is incorrect",
    };
  }

  const hashed =
    await bcrypt.hash(
      newpw,
      10
    );

  await prisma.user.update({
    where: { id: userId },

    data: {
      password: hashed,
    },
  });

  await logActivity(
    userId,
    "Changed Password"
  );

  return {
    success: true,
  };
}

/* =====================================================
   🔐 TOGGLE 2FA
===================================================== */

export async function toggle2FA(
  userId
) {
  const security =
    await prisma.userSecurity.findUnique(
      {
        where: { userId },
      }
    );

  const enabled =
    !security?.twoFAEnabled;

  const backupCodes =
    enabled
      ? Array.from({
          length: 8,
        }).map(() =>
          Math.random()
            .toString(36)
            .slice(2, 10)
            .toUpperCase()
        )
      : [];

  const updated =
    await prisma.userSecurity.upsert(
      {
        where: { userId },

        update: {
          twoFAEnabled:
            enabled,

          backupCodes,
        },

        create: {
          userId,

          twoFAEnabled:
            enabled,

          backupCodes,
        },
      }
    );

  await logActivity(
    userId,
    enabled
      ? "Enabled 2FA"
      : "Disabled 2FA"
  );

  return updated;
}

/* =====================================================
   🔔 NOTIFICATIONS
===================================================== */

export async function updateNotifications(
  userId,
  data
) {
  await prisma.userNotification.upsert(
    {
      where: { userId },

      update: data,

      create: {
        userId,
        ...data,
      },
    }
  );

  await logActivity(
    userId,
    "Updated Notification Preferences"
  );
}

/* =====================================================
   📤 EXPORT
===================================================== */

export async function exportAccountData(
  userId
) {
  return getAccountSettings(
    userId
  );
}

/* =====================================================
   ❌ DELETE ACCOUNT
===================================================== */

export async function deleteAccount(
  userId
) {
  await prisma.$transaction([
    prisma.userActivity.deleteMany(
      {
        where: { userId },
      }
    ),

    prisma.userSession.deleteMany(
      {
        where: { userId },
      }
    ),

    prisma.userNotification.deleteMany(
      {
        where: { userId },
      }
    ),

    prisma.userSecurity.deleteMany(
      {
        where: { userId },
      }
    ),

    prisma.user.delete({
      where: { id: userId },
    }),
  ]);
}

/* =====================================================
   📜 ACTIVITY
===================================================== */

export async function getAccountActivity(
  userId
) {
  return prisma.userActivity.findMany(
    {
      where: { userId },

      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        action: true,
        createdAt: true,
      },
    }
  );
}