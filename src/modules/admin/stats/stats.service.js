// modules/admin/stats/stats.service.js

import prisma from "../../../lib/prisma.js";

import {
  rangeFromDate,
  rangeFromMonth,
  rangeFromWeek,
} from "./stats.utils.js";

/* ==================================================
   BUILD DATE FILTER
================================================== */

const buildDateFilter = ({
  date,
  week,
  month,
}) => {
  let dateFilter = {};

  if (date) {
    const { start, end } =
      rangeFromDate(date);

    dateFilter = {
      createdAt: {
        gte: start,
        lt: end,
      },
    };
  }

  if (week) {
    const { start, end } =
      rangeFromWeek(week);

    dateFilter = {
      createdAt: {
        gte: start,
        lt: end,
      },
    };
  }

  if (month) {
    const { start, end } =
      rangeFromMonth(month);

    dateFilter = {
      createdAt: {
        gte: start,
        lt: end,
      },
    };
  }

  return dateFilter;
};

/* ==================================================
   GET ADMIN STATS
================================================== */

export const getAdminStatsService =
  async ({
    date,
    week,
    month,
  }) => {
    const dateFilter =
      buildDateFilter({
        date,
        week,
        month,
      });

    /* =========================
       EXECUTE QUERIES
    ========================= */

    const [
      totalOrders,

      deliveredOrders,

      cancelledOrders,

      pendingOrders,

      confirmedOrders,

      shippedOrders,

      salesAggregate,

      itemAggregate,

      totalProducts,

      soldAggregate,

      inStock,

      outOfStock,

      totalUsers,

      maleUsers,

      femaleUsers,

      otherUsers,
    ] = await Promise.all([
      /* =========================
         TOTAL ORDERS
      ========================= */

      prisma.order.count({
        where: dateFilter,
      }),

      /* =========================
         DELIVERED ORDERS
      ========================= */

      prisma.order.count({
        where: {
          ...dateFilter,

          status: {
            equals: "delivered",
            mode: "insensitive",
          },
        },
      }),

      /* =========================
         CANCELLED ORDERS
      ========================= */

      prisma.order.count({
        where: {
          ...dateFilter,

          status: {
            equals: "cancelled",
            mode: "insensitive",
          },
        },
      }),

      /* =========================
         PENDING ORDERS
      ========================= */

      prisma.order.count({
        where: {
          ...dateFilter,

          status: {
            equals: "pending",
            mode: "insensitive",
          },
        },
      }),

      /* =========================
         CONFIRMED ORDERS
      ========================= */

      prisma.order.count({
        where: {
          ...dateFilter,

          status: {
            equals: "confirmed",
            mode: "insensitive",
          },
        },
      }),

      /* =========================
         SHIPPED ORDERS
      ========================= */

      prisma.order.count({
        where: {
          ...dateFilter,

          status: {
            equals: "shipped",
            mode: "insensitive",
          },
        },
      }),

      /* =========================
         TOTAL SALES
      ========================= */

      prisma.order.aggregate({
        where: dateFilter,

        _sum: {
          totalAmount: true,
        },
      }),

      /* =========================
         TOTAL ITEMS SOLD
      ========================= */

      prisma.orderItem.aggregate({
        where: {
          order: dateFilter,
        },

        _sum: {
          quantity: true,
        },
      }),

      /* =========================
         TOTAL PRODUCTS
      ========================= */

      prisma.product.count(),

      /* =========================
         SOLD PRODUCTS
      ========================= */

      prisma.product.aggregate({
        _sum: {
          sold: true,
        },
      }),

      /* =========================
         IN STOCK PRODUCTS
      ========================= */

      prisma.product.count({
        where: {
          stock: {
            gt: 0,
          },
        },
      }),

      /* =========================
         OUT OF STOCK PRODUCTS
      ========================= */

      prisma.product.count({
        where: {
          stock: {
            lte: 0,
          },
        },
      }),

      /* =========================
         TOTAL USERS
      ========================= */

      prisma.user.count(),

      /* =========================
         MALE USERS
      ========================= */

      prisma.user.count({
        where: {
          gender: {
            equals: "male",
            mode: "insensitive",
          },
        },
      }),

      /* =========================
         FEMALE USERS
      ========================= */

      prisma.user.count({
        where: {
          gender: {
            equals: "female",
            mode: "insensitive",
          },
        },
      }),

      /* =========================
         OTHER USERS
      ========================= */

      prisma.user.count({
  where: {
    OR: [
      {
        gender: null,
      },

      {
        gender: {
          notIn: [
            "Male",
            "Female",
            "male",
            "female",
          ],
        },
      },
    ],
  },
      }),
    ]);

    /* =========================
       RETURN RESPONSE
    ========================= */

    return {
      totalOrders,

      deliveredOrders,

      cancelledOrders,

      pendingOrders,

      confirmedOrders,

      shippedOrders,

      totalSales:
        salesAggregate._sum
          .totalAmount || 0,

      totalItemsSold:
        itemAggregate._sum
          .quantity || 0,

      total: totalProducts,

      sold:
        soldAggregate._sum
          .sold || 0,

      inStock,

      outOfStock,

      totalUsers,

      maleUsers,

      femaleUsers,

      otherUsers,
    };
  };
