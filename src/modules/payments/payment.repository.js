import prisma from "../../lib/prisma.js";

/* =====================================================
   💾 CREATE ORDER
===================================================== */

export async function createPaymentOrder({
  userId,
  shippingJson,
  totalAmount,
}) {
  /* =========================
     CREATE ORDER
  ========================= */

  const order =
    await prisma.order.create({
      data: {
        userId,

        shippingAddress:
          shippingJson
            ? typeof shippingJson ===
              "string"
              ? JSON.parse(
                  shippingJson
                )
              : shippingJson
            : {},

        totalAmount:
          Number(
            totalAmount
          ) || 0,

        status:
          "Pending",
      },
    });

  return order.id;
}

/* =====================================================
   💾 INSERT ORDER ITEM
===================================================== */

export async function insertOrderItem({
  orderId,
  productId,
  quantity,
  unitPrice,
}) {
  /* =========================
     VALIDATION
  ========================= */

  const product =
    await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

  if (!product) {
    throw new Error(
      `Product not found: ${productId}`
    );
  }

  /* =========================
     CREATE ORDER ITEM
  ========================= */

  return prisma.orderItem.create({
    data: {
      orderId,

      productId,

      quantity:
        Number(
          quantity
        ) || 1,

      unitPrice:
        Number(
          unitPrice
        ) || 0,

      price:
        (Number(
          quantity
        ) || 1) *
        (Number(
          unitPrice
        ) || 0),
    },
  });
}

/* =====================================================
   🔍 GET ORDER
===================================================== */

export async function getOrderById(
  orderId
) {
  return prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
}

/* =====================================================
   🔍 GET ORDER ITEMS
===================================================== */

export async function getOrderItems(
  orderId
) {
  return prisma.orderItem.findMany({
    where: {
      orderId,
    },

    include: {
      product: true,
    },

    orderBy: {
      createdAt:
        "asc",
    },
  });
}

/* =====================================================
   💾 UPDATE RAZORPAY ORDER
===================================================== */

export async function updateRazorpayOrder({
  orderId,
  razorpayOrderId,
  razorpayAmount,
}) {
  /* =========================
     CHECK ORDER
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
     UPDATE ORDER
  ========================= */

  return prisma.order.update({
    where: {
      id: orderId,
    },

    data: {
      razorpayOrderId,

      razorpayAmount:
        Number(
          razorpayAmount
        ) || 0,
    },
  });
}

/* =====================================================
   💾 CONFIRM PAYMENT
===================================================== */

export async function confirmPayment({
  orderId,
  paymentId,
  shiprocketOrderId,
  status,
}) {
  /* =========================
     CHECK ORDER
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
     UPDATE PAYMENT STATUS
  ========================= */

  return prisma.order.update({
    where: {
      id: orderId,
    },

    data: {
      status,

      razorpayPaymentId:
        paymentId,

      shiprocketOrderId:
        shiprocketOrderId ||
        null,
    },
  });
}