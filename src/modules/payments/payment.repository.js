// src/modules/payments/payment.repository.js

import prisma from "../../lib/prisma.js";

import {
  generateOrderNumber,
  generateTemporaryOrderNumber,
} from "../orders/order.service.js";

/* =====================================================
   HELPERS
===================================================== */

function parseShippingAddress(shippingJson) {
  if (!shippingJson) return {};

  if (typeof shippingJson === "object") {
    return shippingJson;
  }

  try {
    return JSON.parse(shippingJson);
  } catch {
    return {};
  }
}

/* =====================================================
   💾 CREATE PAYMENT ORDER
   Initial status must be Pending
===================================================== */

export async function createPaymentOrder({
  userId,
  shippingJson,
  totalAmount,
  status = "Pending",
}) {
  const shippingAddress =
    parseShippingAddress(shippingJson);

  /*
   * Prisma requires orderNumber during creation.
   *
   * We cannot generate the final order number yet
   * because the final format contains order.id.
   *
   * Therefore:
   *
   * 1. Generate temporary order number
   * 2. Create order
   * 3. Get generated order.id
   * 4. Generate final DRIP-YYYYMMDD-orderId
   * 5. Update order
   */

  const orderNumberPlaceholder =
    generateTemporaryOrderNumber();

  /* =================================================
     STEP 1: CREATE PENDING ORDER
  ================================================= */

  const order = await prisma.order.create({
    data: {
      userId,

      orderNumber:
        orderNumberPlaceholder,

      shippingAddress,

      totalAmount:
        Number(totalAmount) || 0,

      status,
    },
  });

  /* =================================================
     STEP 2: GENERATE FINAL ORDER NUMBER
  ================================================= */

  const finalOrderNumber =
    generateOrderNumber(order.id);

  /* =================================================
     STEP 3: UPDATE ORDER NUMBER
  ================================================= */

  const updatedOrder =
    await prisma.order.update({
      where: {
        id: order.id,
      },

      data: {
        orderNumber:
          finalOrderNumber,
      },
    });

  /*
   * Return the internal database order ID.
   *
   * payment.service.js uses this ID for:
   * - OrderItem creation
   * - Razorpay receipt
   * - Razorpay notes
   * - Payment verification
   * - Shiprocket
   */

  return updatedOrder.id;
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

  const qty =
    Number(quantity) || 1;

  const price =
    Number(unitPrice) || 0;

  return prisma.orderItem.create({
    data: {
      orderId,

      productId,

      quantity: qty,

      unitPrice: price,

      price: qty * price,
    },
  });
}

/* =====================================================
   🔍 GET ORDER
===================================================== */

export async function getOrderById(orderId) {
  return prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
}

/* =====================================================
   🔍 GET ORDER BY PAYMENT ID
   Used for idempotency
===================================================== */

export async function getOrderByPaymentId(
  paymentId
) {
  if (!paymentId) {
    return null;
  }

  return prisma.order.findFirst({
    where: {
      razorpayPaymentId: paymentId,
    },
  });
}

/* =====================================================
   🔍 GET ORDER ITEMS
===================================================== */

export async function getOrderItems(orderId) {
  return prisma.orderItem.findMany({
    where: {
      orderId,
    },

    include: {
      product: true,
    },

    orderBy: {
      createdAt: "asc",
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
      razorpayOrderId,

      razorpayAmount:
        Number(razorpayAmount) || 0,
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
  status = "Confirmed",
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
      status,

      razorpayPaymentId:
        paymentId,

      shiprocketOrderId:
        shiprocketOrderId || null,
    },
  });
}

/* =====================================================
   ⏳ EXPIRE OLD PENDING ORDERS
===================================================== */

export async function expirePendingOrdersOlderThan(
  minutes = 30
) {
  const cutoff =
    new Date(
      Date.now() -
        minutes * 60 * 1000
    );

  return prisma.order.updateMany({
    where: {
      status: "Pending",

      razorpayPaymentId: null,

      createdAt: {
        lt: cutoff,
      },
    },

    data: {
      status: "Expired",
    },
  });
}
