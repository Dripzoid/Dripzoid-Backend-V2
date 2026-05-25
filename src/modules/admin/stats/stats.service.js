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
         ORDERS
      ========================= */

      prisma.order.count({
        where: dateFilter,
      }),

      prisma.order.count({
        where: {
          ...dateFilter,
          status: "delivered",
        },
      }),

      prisma.order.count({
        where: {
          ...dateFilter,
          status: "cancelled",
        },
      }),

      prisma.order.count({
        where: {
          ...dateFilter,
          status: "pending",
        },
      }),

      prisma.order.count({
        where: {
          ...dateFilter,
          status: "confirmed",
        },
      }),

      prisma.order.count({
        where: {
          ...dateFilter,
          status: "shipped",
        },
      }),

      prisma.order.aggregate({
        where: dateFilter,
        _sum: {
          totalAmount: true,
        },
      }),

      /* =========================
         ITEMS SOLD
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
         PRODUCTS
      ========================= */

      prisma.product.count(),

      prisma.product.aggregate({
        _sum: {
          sold: true,
        },
      }),

      prisma.product.count({
        where: {
          stock: {
            gt: 0,
          },
        },
      }),

      prisma.product.count({
        where: {
          stock: {
            lte: 0,
          },
        },
      }),

      /* =========================
         USERS
      ========================= */

      prisma.user.count(),

      prisma.user.count({
        where: {
          gender: "male",
        },
      }),

      prisma.user.count({
        where: {
          gender: "female",
        },
      }),

      prisma.user.count({
        where: {
          OR: [
            {
              gender: null,
            },
            {
              gender: {
                notIn: [
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
