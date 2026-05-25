// modules/admin/orders/adminOrders.service.js

import prisma from "../../lib/prisma.js";

import {
  parseImages,
} from "../products/product.utils.js";

/* =====================================================
   📦 GET ALL ORDERS
===================================================== */

export async function getAllOrdersService(
  {
    page = 1,
    limit = 10,
    status,
    search,
    orderId,
    sort = "newest",
  }
) {
  const currentPage =
    Number(page) || 1;

  const showAll =
    String(limit) ===
    "all";

  const pageLimit =
    showAll
      ? undefined
      : Number(limit) ||
        10;

  const skip =
    showAll
      ? undefined
      : (currentPage -
          1) *
        pageLimit;

  /* =========================
     SORT
  ========================= */

  const SORT_MAP = {
    newest: {
      createdAt:
        "desc",
    },

    oldest: {
      createdAt:
        "asc",
    },

    amount_asc: {
      totalAmount:
        "asc",
    },

    amount_desc: {
      totalAmount:
        "desc",
    },

    status_asc: {
      status: "asc",
    },

    status_desc: {
      status:
        "desc",
    },
  };

  const orderBy =
    SORT_MAP[
      sort
    ] ||
    SORT_MAP.newest;

  /* =========================
     WHERE FILTERS
  ========================= */

  const where = {};

  /* STATUS FILTER */

  if (status) {
    where.status = {
      equals:
        String(status)
          .trim()
          .toLowerCase(),
    };
  }

  /* ORDER ID */

  if (orderId) {
    where.id = {
      contains:
        String(orderId),
    };
  }

  /* SEARCH */

  if (
    search &&
    !orderId
  ) {
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
        },
      },
    ];
  }

  /* =========================
     FETCH
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

      orderBy,

      include: {
        user: {
          select: {
            id: true,

            name: true,

            email: true,

            phone: true,
          },
        },

        items: true,
      },
    }),

    prisma.order.count({
      where,
    }),
  ]);

  /* =========================
     FORMAT
  ========================= */

  const formattedOrders =
    orders.map(
      (order) => ({
        ...order,

        user_id:
          order.user
            ?.id || null,

        user_name:
          order.user
            ?.name || null,

        customer_name:
          order.user
            ?.name || null,

        customer_email:
          order.user
            ?.email || null,

        customer_phone:
          order.user
            ?.phone || null,

        items_count:
          order.items
            ?.length || 0,
      })
    );

  return {
    data:
      formattedOrders,

    total,

    totalPages:
      showAll
        ? 1
        : Math.ceil(
            total /
              pageLimit
          ),

    meta: {
      total,

      page:
        currentPage,

      pages:
        showAll
          ? 1
          : Math.ceil(
              total /
                pageLimit
            ),

      limit:
        showAll
          ? total
          : pageLimit,
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
            id: true,

            name: true,

            email: true,

            phone: true,
          },
        },

        items: {
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
     ITEMS
  ========================= */

  const items =
    order.items.map(
      (item) => {
        const images =
          parseImages(
            item.product
              ?.images
          );

        return {
          id:
            item.productId,

          product_id:
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

          selectedColor:
            item.selectedColor,

          selectedSize:
            item.selectedSize,

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

    user_id:
      order.user?.id ||
      null,

    user_name:
      order.user
        ?.name || null,

    customer_name:
      order.user
        ?.name || null,

    customer_email:
      order.user
        ?.email || null,

    customer_phone:
      order.user
        ?.phone || null,

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

  await prisma.order.update({
    where: {
      id: orderId,
    },

    data: {
      status:
        String(status)
          .trim()
          .toLowerCase(),
    },
  });

  return true;
}

/* =====================================================
   📦 BULK UPDATE
===================================================== */

export async function bulkUpdateOrdersService(
  ids,
  status
) {
  if (
    !Array.isArray(ids) ||
    !ids.length
  ) {
    throw new Error(
      "No order IDs provided"
    );
  }

  const normalizedStatus =
    String(status)
      .trim()
      .toLowerCase();

  const result =
    await prisma.order.updateMany({
      where: {
        id: {
          in: ids.map(
            String
          ),
        },
      },

      data: {
        status:
          normalizedStatus,
      },
    });

  return result.count;
}

/* =====================================================
   ❌ DELETE ORDER
===================================================== */

export async function deleteOrderService(
  orderId
) {
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

  await prisma.$transaction([
    prisma.item.deleteMany({
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
