import prisma from "../../lib/prisma.js";

import {
  parseImages,
} from "../products/product.utils.js";

import {
  getTrackingDetails,
  getInvoiceUrl,
  cancelShipment,
} from "../../integrations/shiprocket/shiprocket.service.js";

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

    take: pageLimit,

    orderBy: {
      createdAt: "desc",
    },

    include: {
      items: {
        include: {
          product: true,
        },
      },

      shipment: {
        include: {
          trackingEvents: {
            orderBy: {
              createdAt: "desc",
            },
          },
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

      shipment: {
        include: {
          trackingEvents: {
            orderBy: {
              createdAt: "desc",
            },
          },
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
        shipment: true,
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

  const allowedStatuses = [
    "pending",
    "confirmed",
    "packed",
  ];

  if (
    !allowedStatuses.includes(
      String(
        order.status
      ).toLowerCase()
    )
  ) {
    throw new Error(
      "Order cannot be cancelled"
    );
  }

  /* =========================
     CANCEL SHIPROCKET ORDER
  ========================= */

  if (
    order.shipment
      ?.shiprocketOrderId
  ) {
    try {
      await cancelShipment(
        order.shipment
          .shiprocketOrderId
      );

      console.log(
        "✅ Shiprocket order cancelled:",
        order.shipment
          .shiprocketOrderId
      );
    } catch (error) {
      console.error(
        "❌ Shiprocket cancellation failed:",
        error?.response?.data ||
          error.message
      );

      throw new Error(
        "Failed to cancel shipment"
      );
    }
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
         UPDATE SHIPMENT
      ===================== */

      if (order.shipment) {
        await tx.shipment.update({
          where: {
            orderId,
          },

          data: {
            shipmentStatus:
              "Cancelled",
          },
        });

        await tx.shipmentTracking.create({
          data: {
            shipmentId:
              order.shipment.id,

            status:
              "Cancelled",

            activity:
              "Order cancelled by user",

            scanTimestamp:
              new Date(),
          },
        });
      }

      /* =====================
         RESTORE INVENTORY
      ===================== */

      for (const item of order.items) {
        const product =
          await tx.product.findUnique({
            where: {
              id:
                item.productId,
            },

            select: {
              id: true,
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

        /* =====================
           RESTORE SIZE STOCK
        ===================== */

        if (
          item.selectedSize
        ) {
          await tx.productSize.updateMany({
            where: {
              productId:
                item.productId,

              size:
                item.selectedSize,
            },

            data: {
              stock: {
                increment:
                  item.quantity,
              },
            },
          });
        }
      }
    }
  );

  /* =========================
     FETCH UPDATED ORDER
  ========================= */

  const updatedOrder =
    await prisma.order.findUnique({
      where: {
        id: orderId,
      },

      select: {
        id: true,
        orderNumber: true,
        paymentMethod: true,
        status: true,
      },
    });

  return updatedOrder;
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
function generateTemporaryOrderNumber() {
  const now = Date.now();

  const rand =
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase();

  return `TMP-${now}-${rand}`;
}

function generateOrderNumber(orderId) {
  const now = new Date();

  return `DRIP-${
    now.getFullYear()
  }${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}-${orderId}`;
}
  const tempOrderNumber =
  generateTemporaryOrderNumber();

const newOrder =
  await prisma.order.create({
    data: {
      userId,

      orderNumber:
        tempOrderNumber,

      totalAmount:
        oldOrder.totalAmount,

      status:
        "Confirmed",

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

const finalOrderNumber =
  generateOrderNumber(
    newOrder.id
  );

const updatedOrder =
  await prisma.order.update({
    where: {
      id: newOrder.id,
    },

    data: {
      orderNumber:
        finalOrderNumber,
    },
  });

await prisma.shipment.create({
  data: {
    orderId:
      updatedOrder.id,

    shipmentStatus:
      "Confirmed",
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
    updatedOrder.id,

  orderNumber:
    finalOrderNumber,
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

    include: {
      shipment: true,
    },
  });

  if (!order) {
    throw new Error(
      "Order not found"
    );
  }

 if (
  !order.shipment
    ?.shiprocketOrderId
) {
    throw new Error(
      "Shipment not created yet"
    );
  }

  return getTrackingDetails(
  order.shipment
    .shiprocketOrderId
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

    include: {
      shipment: true,
    },
  });

  if (!order) {
    throw new Error(
      "Order not found"
    );
  }

 if (
  !order.shipment
    ?.shiprocketOrderId
) {
    throw new Error(
      "Invoice unavailable"
    );
  }

 return getInvoiceUrl(
  order.shipment
    .shiprocketOrderId
);
}
