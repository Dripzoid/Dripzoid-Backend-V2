import prisma from "../../lib/prisma.js";

/* =====================================================
   🆔 GENERATE ID
===================================================== */

function uid(prefix = "c_") {
  return (
    prefix +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

/* =====================================================
   📝 AUDIT LOGGER
===================================================== */

export async function auditCoupon({
  coupon_id = null,
  action,
  message,
  actor = "system",
}) {
  await prisma.couponAuditLog.create({
    data: {
      couponId:
        coupon_id,

      action,

      message,

      actor,
    },
  });
}

/* =====================================================
   📦 GET ALL COUPONS
===================================================== */

export async function getCouponsService() {
  return prisma.coupon.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

/* =====================================================
   ➕ CREATE COUPON
===================================================== */

export async function createCouponService(
  c
) {
  if (!c?.code) {
    throw new Error(
      "code_required"
    );
  }

  const normalizedCode =
    String(c.code)
      .toUpperCase()
      .trim();

  /* =========================
     CHECK EXISTING
  ========================= */

  const existing =
    await prisma.coupon.findUnique({
      where: {
        code:
          normalizedCode,
      },
    });

  if (existing) {
    throw new Error(
      "code_exists"
    );
  }

  const id = uid();

  /* =========================
     CREATE COUPON
  ========================= */

  const coupon =
    await prisma.coupon.create({
      data: {
        id,

        code:
          normalizedCode,

        type:
          c.type ||
          "percentage",

        amount: Number(
          c.amount || 0
        ),

        minPurchase:
          Number(
            c.min_purchase ||
              0
          ),

        usageLimit:
          Number(
            c.usage_limit ||
              0
          ),

        used: 0,

        startsAt:
          c.starts_at
            ? new Date(
                c.starts_at
              )
            : null,

        endsAt:
          c.ends_at
            ? new Date(
                c.ends_at
              )
            : null,

        active:
          Boolean(
            c.active
          ),

        appliesTo:
          c.applies_to ||
          "all",

        description:
          c.description ||
          "",
      },
    });

  /* =========================
     AUDIT LOG
  ========================= */

  await auditCoupon({
    coupon_id:
      coupon.id,

    action:
      "CREATED",

    message:
      `Created coupon ${coupon.code}`,
  });

  return {
    id: coupon.id,
  };
}

/* =====================================================
   ✏️ UPDATE COUPON
===================================================== */

export async function updateCouponService(
  id,
  c
) {
  const existing =
    await prisma.coupon.findUnique({
      where: {
        id,
      },
    });

  if (!existing) {
    throw new Error(
      "not_found"
    );
  }

  /* =========================
     UPDATE COUPON
  ========================= */

  const updatedCoupon =
    await prisma.coupon.update({
      where: {
        id,
      },

      data: {
        code:
          c.code
            ? String(
                c.code
              )
                .toUpperCase()
                .trim()
            : existing.code,

        type:
          c.type ??
          existing.type,

        amount: Number(
          c.amount ??
            existing.amount
        ),

        minPurchase:
          Number(
            c.min_purchase ??
              existing.minPurchase
          ),

        usageLimit:
          Number(
            c.usage_limit ??
              existing.usageLimit
          ),

        active:
          c.active ===
          undefined
            ? existing.active
            : Boolean(
                c.active
              ),

        description:
          c.description ??
          existing.description,
      },
    });

  /* =========================
     AUDIT LOG
  ========================= */

  await auditCoupon({
    coupon_id:
      updatedCoupon.id,

    action:
      "UPDATED",

    message:
      `Updated coupon ${updatedCoupon.code}`,
  });

  return true;
}

/* =====================================================
   ❌ DELETE COUPON
===================================================== */

export async function deleteCouponService(
  id
) {
  const existing =
    await prisma.coupon.findUnique({
      where: {
        id,
      },
    });

  if (!existing) {
    throw new Error(
      "not_found"
    );
  }

  /* =========================
     DELETE COUPON
  ========================= */

  await prisma.coupon.delete({
    where: {
      id,
    },
  });

  /* =========================
     AUDIT LOG
  ========================= */

  await auditCoupon({
    coupon_id: id,

    action:
      "DELETED",

    message:
      "Coupon deleted",
  });

  return true;
}

/* =====================================================
   🔥 BULK ACTIONS
===================================================== */

export async function bulkCouponActionService({
  action,
  ids,
}) {
  if (
    !Array.isArray(ids) ||
    !action
  ) {
    throw new Error(
      "invalid"
    );
  }

  /* =========================
     ENABLE
  ========================= */

  if (action === "enable") {
    await prisma.coupon.updateMany({
      where: {
        id: {
          in: ids,
        },
      },

      data: {
        active: true,
      },
    });
  }

  /* =========================
     DISABLE
  ========================= */

  if (action === "disable") {
    await prisma.coupon.updateMany({
      where: {
        id: {
          in: ids,
        },
      },

      data: {
        active: false,
      },
    });
  }

  /* =========================
     DELETE
  ========================= */

  if (action === "delete") {
    await prisma.coupon.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  /* =========================
     AUDIT LOG
  ========================= */

  await auditCoupon({
    action:
      `BULK_${action.toUpperCase()}`,

    message:
      `${ids.length} coupons affected`,
  });

  return true;
}

/* =====================================================
   🎟️ REDEEM COUPON
===================================================== */

export async function redeemCouponService({
  code,
  order_id,
  user_id,
  cart_total,
}) {
  if (!code) {
    throw new Error(
      "code_required"
    );
  }

  const normalizedCode =
    String(code)
      .toUpperCase()
      .trim();

  /* =========================
     FIND COUPON
  ========================= */

  const coupon =
    await prisma.coupon.findFirst({
      where: {
        code:
          normalizedCode,

        active: true,
      },
    });

  if (!coupon) {
    throw new Error(
      "invalid_coupon"
    );
  }

  /* =========================
     USAGE LIMIT
  ========================= */

  if (
    coupon.usageLimit &&
    coupon.used >=
      coupon.usageLimit
  ) {
    throw new Error(
      "usage_limit_reached"
    );
  }

  /* =========================
     MIN PURCHASE
  ========================= */

  if (
    coupon.minPurchase &&
    Number(cart_total) <
      Number(
        coupon.minPurchase
      )
  ) {
    throw new Error(
      "min_purchase_not_met"
    );
  }

  /* =========================
     DATE VALIDATION
  ========================= */

  const now =
    new Date();

  if (
    coupon.startsAt &&
    now < coupon.startsAt
  ) {
    throw new Error(
      "coupon_not_started"
    );
  }

  if (
    coupon.endsAt &&
    now > coupon.endsAt
  ) {
    throw new Error(
      "coupon_expired"
    );
  }

  /* =========================
     CALCULATE DISCOUNT
  ========================= */

  const discount =
    coupon.type ===
    "percentage"
      ? (Number(
            cart_total
          ) *
          Number(
            coupon.amount
          )) /
        100
      : Number(
          coupon.amount
        );

  /* =========================
     TRANSACTION
  ========================= */

  await prisma.$transaction([
    prisma.coupon.update({
      where: {
        id: coupon.id,
      },

      data: {
        used: {
          increment: 1,
        },
      },
    }),

    prisma.couponUsage.create({
      data: {
        couponId:
          coupon.id,

        orderId:
          order_id ||
          null,

        userId:
          user_id ||
          null,

        discountAmount:
          discount,
      },
    }),
  ]);

  /* =========================
     AUDIT LOG
  ========================= */

  await auditCoupon({
    coupon_id:
      coupon.id,

    action:
      "REDEEMED",

    message:
      `Coupon ${coupon.code} redeemed`,
  });

  return {
    success: true,

    discount,

    coupon,
  };
}

/* =====================================================
   📊 ANALYTICS
===================================================== */

export async function getCouponAnalyticsService() {
  const analytics =
    await prisma.coupon.aggregate({
      _sum: {
        used: true,
      },
    });

  return {
    totalRedemptions:
      analytics._sum
        .used || 0,
  };
}

/* =====================================================
   📜 AUDIT LOGS
===================================================== */

export async function getCouponAuditLogsService() {
  return prisma.couponAuditLog.findMany({
    orderBy: {
      createdAt: "desc",
    },

    take: 200,
  });
}