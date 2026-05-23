import prisma from "../../lib/prisma.js";

import {
  parseImages,
} from "../products/product.utils.js";

/* =====================================================
   🆔 GENERATE ORDER NUMBER
===================================================== */

function generateOrderNumber(
  orderId
) {
  const now =
    new Date();

  const y =
    now.getFullYear();

  const m =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const d =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `DRIP-${y}${m}${d}-${orderId}`;
}

/* =====================================================
   🚀 CREATE ORDER
===================================================== */

export async function createOrderService({
  userId,
  items,
  shippingAddress,
  paymentMethod,
  paymentDetails,
  totalAmount,
  deliveryDate,
}) {
  if (
    !items ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error(
      "Order items required"
    );
  }

  return prisma.$transaction(
    async (tx) => {
      /* =====================================
         📦 VALIDATE STOCK
      ===================================== */

      for (const item of items) {
        const product =
          await tx.product.findUnique({
            where: {
              id:
                item.product_id,
            },

            select: {
              id: true,
              stock: true,
              sold: true,
            },
          });

        if (!product) {
          throw new Error(
            `Product ${item.product_id} not found`
          );
        }

        if (
          product.stock !==
            null &&
          product.stock <
            item.quantity
        ) {
          throw new Error(
            `Insufficient stock for product ${item.product_id}`
          );
        }
      }

      /* =====================================
         📝 CREATE ORDER
      ===================================== */

      const order =
        await tx.order.create({
          data: {
            userId,

            addressId:
              shippingAddress?.id ||
              null,

            shippingAddress:
              shippingAddress ||
              {},

            paymentMethod:
              paymentMethod ||
              "",

            paymentDetails:
              paymentDetails ||
              {},

            totalAmount:
              Number(
                totalAmount ||
                  0
              ),

            status:
              "Confirmed",

            deliveryDate:
              deliveryDate
                ? new Date(
                    deliveryDate
                  )
                : null,
          },
        });

      /* =====================================
         🆔 GENERATE ORDER NUMBER
      ===================================== */

      const orderNumber =
        generateOrderNumber(
          order.id
        );

      /* =====================================
         📝 UPDATE ORDER NUMBER
      ===================================== */

      const updatedOrder =
        await tx.order.update({
          where: {
            id:
              order.id,
          },

          data: {
            orderNumber,
          },
        });

      /* =====================================
         📦 CREATE ORDER ITEMS
      ===================================== */

      for (const item of items) {
        const unitPrice =
          Number(
            item.unit_price
          );

        const quantity =
          Number(
            item.quantity
          );

        const totalPrice =
          unitPrice *
          quantity;

        await tx.orderItem.create({
          data: {
            orderId:
              updatedOrder.id,

            productId:
              item.product_id,

            quantity,

            unitPrice,

            price:
              totalPrice,

            selectedColor:
              item.selectedColor ||
              null,

            selectedSize:
              item.selectedSize ||
              null,
          },
        });

        /* =========================
           UPDATE PRODUCT
        ========================= */

        const existingProduct =
          await tx.product.findUnique({
            where: {
              id:
                item.product_id,
            },

            select: {
              sold: true,
              stock: true,
            },
          });

        await tx.product.update({
          where: {
            id:
              item.product_id,
          },

          data: {
            sold:
              (existingProduct
                ?.sold ||
                0) +
              quantity,

            stock:
              existingProduct
                ?.stock !==
                null
                ? existingProduct.stock -
                  quantity
                : null,
          },
        });
      }

      /* =====================================
         🛒 CLEAR CART
      ===================================== */

      await tx.cartItem.deleteMany({
        where: {
          userId,
        },
      });

      return {
        orderId:
          updatedOrder.id,

        orderNumber:
          orderNumber,
      };
    }
  );
}

/* =====================================================
   🚚 ATTACH SHIPMENT
===================================================== */

export async function attachShipmentToOrderService({
  orderId,
  shiprocketOrderId,
  shipmentId = null,
  awbCode = null,
}) {
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
      shiprocketOrderId,
      shipmentId,
      awbCode,
    },
  });

  return true;
}

/* =====================================================
   🚚 UPDATE SHIPMENT STATUS
===================================================== */

export async function updateOrderShipmentStatusService({
  orderId,
  shipmentStatus,
  awbCode = null,
  courierName = null,
  trackingUrl = null,
}) {
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

  return prisma.order.update({
    where: {
      id: orderId,
    },

    data: {
      shipmentStatus:
        shipmentStatus ||
        existingOrder.shipmentStatus,

      awbCode:
        awbCode ||
        existingOrder.awbCode,

      courierName:
        courierName ||
        existingOrder.courierName,

      trackingUrl:
        trackingUrl ||
        existingOrder.trackingUrl,
    },
  });
}

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

  const where = {
    userId,
  };

  if (status) {
    where.status = {
      equals: status,
      mode: "insensitive",
    };
  }

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

  const allowedStatuses =
    [
      "pending",
      "confirmed",
      "shipped",
      "packed",
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

  await prisma.$transaction(
    async (tx) => {
      await tx.order.update({
        where: {
          id: orderId,
        },

        data: {
          status:
            "cancelled",
        },
      });

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

    const existingProduct =
      await prisma.product.findUnique({
        where: {
          id:
            item.productId,
        },

        select: {
          stock: true,
          sold: true,
        },
      });

    if (
      existingProduct
    ) {
      await prisma.product.update({
        where: {
          id:
            item.productId,
        },

        data: {
          sold:
            (existingProduct
              ?.sold ||
              0) +
            item.quantity,

          stock:
            existingProduct.stock !==
            null
              ? existingProduct.stock -
                item.quantity
              : null,
        },
      });
    }
  }

  return {
    orderId:
      newOrder.id,
  };
}