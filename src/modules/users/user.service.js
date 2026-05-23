import prisma from "../../lib/prisma.js";

/* =====================================================
   📦 GET ALL USERS WITH STATS
===================================================== */

export async function getAllUsersWithStats() {
  /* =========================
     FETCH USERS
  ========================= */

  const users =
    await prisma.user.findMany({
      select: {
        id: true,

        name: true,

        email: true,

        phone: true,

        isAdmin: true,

        createdAt: true,

        gender: true,

        dob: true,

        orders: {
          select: {
            totalAmount:
              true,
          },
        },

        sessions: {
          orderBy: {
            lastActive:
              "desc",
          },

          take: 1,

          select: {
            lastActive:
              true,
          },
        },
      },

      orderBy: {
        createdAt:
          "desc",
      },
    });

  /* =========================
     FORMAT USERS
  ========================= */

  return users.map(
    (user) => {
      const totalOrders =
        user.orders.length;

      const totalSpend =
        user.orders.reduce(
          (
            acc,
            order
          ) =>
            acc +
            Number(
              order.totalAmount ||
                0
            ),

          0
        );

      return {
        id:
          user.id,

        name:
          user.name,

        email:
          user.email,

        phone:
          user.phone,

        is_admin:
          user.isAdmin,

        created_at:
          user.createdAt,

        gender:
          user.gender,

        dob:
          user.dob,

        role:
          user.isAdmin
            ? "admin"
            : "customer",

        totalOrders,

        totalSpend,

        last_active:
          user.sessions[0]
            ?.lastActive ||
          null,
      };
    }
  );
}

/* =====================================================
   📦 GET SINGLE USER
===================================================== */

export async function getUserById(
  userId
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,

        name: true,

        email: true,

        phone: true,

        isAdmin: true,

        createdAt: true,

        gender: true,

        dob: true,
      },
    });

  if (!user) {
    throw new Error(
      "User not found"
    );
  }

  return {
    ...user,

    is_admin:
      user.isAdmin,

    created_at:
      user.createdAt,
  };
}

/* =====================================================
   ✏️ UPDATE USER
===================================================== */

export async function updateUser(
  userId,
  data
) {
  const {
    name,
    phone,
    gender,
    dob,
    is_admin,
  } = data;

  /* =========================
     CHECK USER
  ========================= */

  const existingUser =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

  if (!existingUser) {
    throw new Error(
      "User not found"
    );
  }

  /* =========================
     UPDATE USER
  ========================= */

  await prisma.user.update({
    where: {
      id: userId,
    },

    data: {
      name:
        name ??
        existingUser.name,

      phone:
        phone ??
        existingUser.phone,

      gender:
        gender ??
        existingUser.gender,

      dob:
        dob
          ? new Date(
              dob
            )
          : existingUser.dob,

      isAdmin:
        typeof is_admin ===
        "boolean"
          ? is_admin
          : existingUser.isAdmin,
    },
  });

  return true;
}

/* =====================================================
   ❌ DELETE USER
===================================================== */

export async function deleteUser(
  userId
) {
  /* =========================
     CHECK USER
  ========================= */

  const existingUser =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

  if (!existingUser) {
    throw new Error(
      "User not found"
    );
  }

  /* =========================
     DELETE RELATED DATA
  ========================= */

  await prisma.$transaction([
    prisma.userSession.deleteMany(
      {
        where: {
          userId,
        },
      }
    ),

    prisma.order.deleteMany({
      where: {
        userId,
      },
    }),

    prisma.review.deleteMany(
      {
        where: {
          userId,
        },
      }
    ),

    prisma.question.deleteMany(
      {
        where: {
          userId,
        },
      }
    ),

    prisma.answer.deleteMany(
      {
        where: {
          userId,
        },
      }
    ),

    prisma.cartItem.deleteMany(
      {
        where: {
          userId,
        },
      }
    ),

    prisma.address.deleteMany(
      {
        where: {
          userId,
        },
      }
    ),

    prisma.user.delete({
      where: {
        id: userId,
      },
    }),
  ]);

  return true;
}