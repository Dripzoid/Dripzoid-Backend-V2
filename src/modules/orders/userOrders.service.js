import prisma from "../../lib/prisma.js";

import {
  parseImages,
} from "../products/product.utils.js";
import {
  getTrackingDetails,
  getInvoiceUrl,
} from  "../../integrations/shiprocket/shiprocket.service.js";

/* =====================================================
   📦 GET USER ORDERS
===================================================== */

export async function getUserOrdersService(
  userId,
  {
    page = 1,
    limit = 10,
    status,
  }
) {
  const currentPage =
    Number(page) || 1;

  const pageLimit =
    Number(limit) || 10;

  const skip =
    (currentPage - 1) *
    pageLimit;

  /* =========================
     WHERE FILTER
  ========================= */

  const where = {
    userId,
  };

  if (status) {
    where.status = {
      equals: status,
      mode: "insensitive",
    };
  }

  /* =========================
     FETCH ORDERS
  ========================= */

  const orders =
    await prisma.order.findMany({
      where,

      skip,

      take:
        pageLimit,

      orderBy: {
        createdAt:
          "desc",
      },

      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

  /* =========================
     FORMAT RESPONSE
  ========================= */

  return orders.map(
    (order) => ({
      ...order,

      items:
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
        ),
    })
  );
}

/* =====================================================
   📦 GET SINGLE ORDER
===================================================== */

export async function getOrderByIdService(
  userId,
  orderId
) {
  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,

        userId,
      },

      include: {
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
     FORMAT ITEMS
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

    items,
  };
}

/* =====================================================
   ❌ CANCEL ORDER
===================================================== */

export async function cancelOrderService(
  userId,
  orderId
) {
  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,

        userId,
      },

      include: {
        items: true,
      },
    });

  if (!order) {
    throw new Error(
      "Order not found"
    );
  }

  /* =========================
     ALLOWED STATUSES
  ========================= */

  const allowedStatuses =
    [
      "Pending",
      "Confirmed",
      "Shipped",
      "Packed",
    ];

  if (
    !allowedStatuses.includes(
      order.status.toLowerCase()
    )
  ) {
    throw new Error(
      "Order cannot be cancelled"
    );
  }

  /* =========================
     TRANSACTION
  ========================= */

  await prisma.$transaction(
    async (tx) => {
      /* =====================
         UPDATE ORDER STATUS
      ===================== */

      await tx.order.update({
        where: {
          id: orderId,
        },

        data: {
          status:
            "Cancelled",
        },
      });

      /* =====================
         RESTORE STOCK
      ===================== */

      for (const item of order.items) {
        const product =
          await tx.product.findUnique({
            where: {
              id:
                item.productId,
            },

            select: {
              stock: true,

              sold: true,
            },
          });

        if (!product) {
          continue;
        }

        await tx.product.update({
          where: {
            id:
              item.productId,
          },

          data: {
            stock:
              product.stock !==
              null
                ? product.stock +
                  item.quantity
                : null,

            sold:
              Math.max(
                0,
                (product.sold ||
                  0) -
                  item.quantity
              ),
          },
        });
      }
    }
  );

  return true;
}

/* =====================================================
   🔁 REORDER
===================================================== */

export async function reorderService(
  userId,
  orderId
) {
  const oldOrder =
    await prisma.order.findFirst({
      where: {
        id: orderId,

        userId,
      },

      include: {
        items: true,
      },
    });

  if (!oldOrder) {
    throw new Error(
      "Order not found"
    );
  }

  if (
    !oldOrder.items.length
  ) {
    throw new Error(
      "No items to reorder"
    );
  }

  /* =========================
     CREATE NEW ORDER
  ========================= */

  const newOrder =
    await prisma.order.create({
      data: {
        userId,

        totalAmount:
          oldOrder.totalAmount,

        status:
          "Pending",

        paymentMethod:
          oldOrder.paymentMethod,

        paymentDetails:
          oldOrder.paymentDetails,

        shippingAddress:
          oldOrder.shippingAddress,

        addressId:
          oldOrder.addressId,

        deliveryDate:
          oldOrder.deliveryDate,
      },
    });

  /* =========================
     DUPLICATE ORDER ITEMS
  ========================= */

  for (const item of oldOrder.items) {
    await prisma.orderItem.create({
      data: {
        orderId:
          newOrder.id,

        productId:
          item.productId,

        quantity:
          item.quantity,

        unitPrice:
          item.unitPrice,

        price:
          item.price,

        selectedColor:
          item.selectedColor,

        selectedSize:
          item.selectedSize,
      },
    });
  }

  return {
    orderId:
      newOrder.id,
  };
}

export async function verifyProductPurchaseService(
  userId,
  productId
) {
  const order =
    await prisma.orderItem.findFirst({
      where: {
        productId,

        order: {
          userId,

          status: {
            equals: "Delivered",
            mode: "insensitive",
          },
        },
      },
    });

  return !!order;
}

/* =====================================================
   📍 TRACK ORDER
===================================================== */

export async function trackOrderService(
  userId,
  orderId
) {
  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: {
        id: true,
        status: true,
        shiprocketOrderId: true,
      },
    });

  if (!order) {
    throw new Error(
      "Order not found"
    );
  }

  if (
    !order.shiprocketOrderId
  ) {
    throw new Error(
      "Shipment not created yet"
    );
  }

  return getTrackingDetails(
    order.shiprocketOrderId
  );
}

/* =====================================================
   🧾 DOWNLOAD INVOICE
===================================================== */

export async function downloadInvoiceService(
  userId,
  orderId
) {
  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: {
        id: true,
        shiprocketOrderId: true,
      },
    });

  if (!order) {
    throw new Error(
      "Order not found"
    );
  }

  if (
    !order.shiprocketOrderId
  ) {
    throw new Error(
      "Invoice unavailable"
    );
  }

  return getInvoiceUrl(
    order.shiprocketOrderId
  );
}
