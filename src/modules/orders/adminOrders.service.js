import prisma from "../../lib/prisma.js";

import {
  parseImages,
} from "../products/product.utils.js";

/* =====================================================
   📦 GET ALL ORDERS
===================================================== */

export async function getAllOrdersService({
  page = 1,
  limit = 10,
  status,
  search,
}) {
  const currentPage =
    Number(page) || 1;

  const pageLimit =
    Number(limit) || 10;

  const skip =
    (currentPage - 1) *
    pageLimit;

  /* =========================
     WHERE FILTERS
  ========================= */

  const where = {};

  /* STATUS FILTER */

  if (status) {
    where.status = {
      equals: status,
      mode: "insensitive",
    };
  }

  /* SEARCH FILTER */

  if (search) {
    where.OR = [
      {
        user: {
          name: {
            contains:
              search,
            mode:
              "insensitive",
          },
        },
      },

      {
        user: {
          email: {
            contains:
              search,
            mode:
              "insensitive",
          },
        },
      },

      {
        id: {
          contains:
            search,
          mode:
            "insensitive",
        },
      },
    ];
  }

  /* =========================
     FETCH ORDERS
  ========================= */

  const [
    orders,
    total,
  ] = await prisma.$transaction([
    prisma.order.findMany({
      where,

      skip,

      take:
        pageLimit,

      orderBy: {
        createdAt:
          "desc",
      },

      include: {
        user: {
          select: {
            name: true,

            email: true,

            phone: true,
          },
        },
      },
    }),

    prisma.order.count({
      where,
    }),
  ]);

  /* =========================
     FORMAT RESPONSE
  ========================= */

  const formattedOrders =
    orders.map((order) => ({
      ...order,

      customer_name:
        order.user?.name ||
        null,

      customer_email:
        order.user?.email ||
        null,

      customer_phone:
        order.user?.phone ||
        null,
    }));

  return {
    data:
      formattedOrders,

    meta: {
      total,

      page:
        currentPage,

      pages:
        Math.ceil(
          total /
            pageLimit
        ),

      limit:
        pageLimit,
    },
  };
}

/* =====================================================
   📦 GET SINGLE ORDER
===================================================== */

export async function getAdminOrderByIdService(
  orderId
) {
  const order =
    await prisma.order.findUnique({
      where: {
        id: orderId,
      },

      include: {
        user: {
          select: {
            name: true,

            email: true,

            phone: true,
          },
        },

        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

  if (!order) {
    throw new Error(
      "Order not found"
    );
  }

  /* =========================
     FORMAT ITEMS
  ========================= */

  const items =
    order.orderItems.map(
      (item) => {
        const images =
          parseImages(
            item.product
              ?.images
          );

        return {
          id:
            item.productId,

          name:
            item.product
              ?.name ||
            null,

          image:
            images[0] ||
            null,

          images,

          quantity:
            item.quantity,

          price:
            item.price,

          options: {
            color:
              item.selectedColor,

            size:
              item.selectedSize,
          },
        };
      }
    );

  return {
    ...order,

    customer_name:
      order.user?.name ||
      null,

    customer_email:
      order.user?.email ||
      null,

    customer_phone:
      order.user?.phone ||
      null,

    items,
  };
}

/* =====================================================
   🔄 UPDATE ORDER STATUS
===================================================== */

export async function updateOrderStatusService(
  orderId,
  status
) {
  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingOrder =
    await prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

  if (!existingOrder) {
    throw new Error(
      "Order not found"
    );
  }

  /* =========================
     UPDATE STATUS
  ========================= */

  await prisma.order.update({
    where: {
      id: orderId,
    },

    data: {
      status,
    },
  });

  return true;
}

/* =====================================================
   ❌ DELETE ORDER
===================================================== */

export async function deleteOrderService(
  orderId
) {
  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingOrder =
    await prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

  if (!existingOrder) {
    throw new Error(
      "Order not found"
    );
  }

  /* =========================
     DELETE TRANSACTION
  ========================= */

  await prisma.$transaction([
    prisma.orderItem.deleteMany({
      where: {
        orderId,
      },
    }),

    prisma.order.delete({
      where: {
        id: orderId,
      },
    }),
  ]);

  return true;
}