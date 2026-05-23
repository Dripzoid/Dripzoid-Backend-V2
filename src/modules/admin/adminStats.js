import express from "express";
import prisma from "../lib/prisma.js";
import authMiddleware from "./authAdmin.js";

const router = express.Router();

/* ==================================================
   DATE RANGE HELPERS
================================================== */

const rangeFromDate = (dateStr) => {
  const start = new Date(dateStr);
  const end = new Date(start);

  end.setDate(end.getDate() + 1);

  return { start, end };
};

const rangeFromMonth = (monthStr) => {
  const [year, month] =
    monthStr.split("-").map(Number);

  const start = new Date(year, month - 1, 1);

  const end = new Date(year, month, 1);

  return { start, end };
};

const isoWeekStart = (year, week) => {
  const simple =
    new Date(year, 0, 1 + (week - 1) * 7);

  const dow = simple.getDay();

  const ISOweekStart = simple;

  if (dow <= 4) {
    ISOweekStart.setDate(
      simple.getDate() - simple.getDay() + 1
    );
  } else {
    ISOweekStart.setDate(
      simple.getDate() + 8 - simple.getDay()
    );
  }

  return ISOweekStart;
};

const rangeFromWeek = (weekStr) => {
  const [year, week] =
    weekStr.replace("W", "-").split("-");

  const start =
    isoWeekStart(Number(year), Number(week));

  const end = new Date(start);

  end.setDate(end.getDate() + 7);

  return { start, end };
};

/* ==================================================
   ADMIN STATS
================================================== */

router.get(
  "/stats",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        date,
        week,
        month,
      } = req.query;

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

      /* =========================
         ORDERS
      ========================= */

      const totalOrders =
        await prisma.order.count({
          where: dateFilter,
        });

      const deliveredOrders =
        await prisma.order.count({
          where: {
            ...dateFilter,
            status: "delivered",
          },
        });

      const cancelledOrders =
        await prisma.order.count({
          where: {
            ...dateFilter,
            status: "cancelled",
          },
        });

      const pendingOrders =
        await prisma.order.count({
          where: {
            ...dateFilter,
            status: "pending",
          },
        });

      const confirmedOrders =
        await prisma.order.count({
          where: {
            ...dateFilter,
            status: "confirmed",
          },
        });

      const shippedOrders =
        await prisma.order.count({
          where: {
            ...dateFilter,
            status: "shipped",
          },
        });

      const salesAggregate =
        await prisma.order.aggregate({
          where: dateFilter,
          _sum: {
            totalAmount: true,
          },
        });

      /* =========================
         ITEMS SOLD
      ========================= */

      const itemAggregate =
        await prisma.orderItem.aggregate({
          _sum: {
            quantity: true,
          },
        });

      /* =========================
         PRODUCTS
      ========================= */

      const totalProducts =
        await prisma.product.count();

      const soldAggregate =
        await prisma.product.aggregate({
          _sum: {
            sold: true,
          },
        });

      const inStock =
        await prisma.product.count({
          where: {
            stock: {
              gt: 0,
            },
          },
        });

      const outOfStock =
        await prisma.product.count({
          where: {
            stock: {
              lte: 0,
            },
          },
        });

      /* =========================
         USERS
      ========================= */

      const totalUsers =
        await prisma.user.count();

      const maleUsers =
        await prisma.user.count({
          where: {
            gender: "male",
          },
        });

      const femaleUsers =
        await prisma.user.count({
          where: {
            gender: "female",
          },
        });

      const otherUsers =
        await prisma.user.count({
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
        });

      return res.json({
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
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Failed to fetch stats",
      });
    }
  }
);

export default router;