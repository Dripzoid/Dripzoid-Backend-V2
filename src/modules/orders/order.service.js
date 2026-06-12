import prisma from "../../lib/prisma.js";
import { parseImages } from "../products/product.utils.js";
import { triggerAutomationEvent } from "../../integrations/automation/automation.service.js";
import { EVENT_TYPES } from "../../config/eventTypes.js";

async function queueOrderCancelledEvent({
  order,
  userId,
}) {
  let automationEvent;

  try {
    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

    if (!user) {
      throw new Error(
        `User not found: ${userId}`
      );
    }

    const payload = {
      customer_name:
        user.name || "Customer",

      email:
        user.email,

      user_id:
        user.id,

      order_id:
        order.id,

      order_number:
        order.orderNumber,

      cancellation_date:
        new Date().toISOString(),

      payment_method:
        order.paymentMethod ||
        "N/A",

      order_url:
        `${process.env.CLIENT_URL}/order-details/${order.id}`,
    };

    automationEvent =
      await prisma.automationEvent.create({
        data: {
          eventType:
            EVENT_TYPES.ORDER_CANCELLED,

          payload,

          source:
            "dripzoid-backend",

          status:
            "pending",
        },
      });

    await triggerAutomationEvent(
      EVENT_TYPES.ORDER_CANCELLED,
      {
        automationEventId:
          automationEvent.id,

        ...payload,
      }
    );

    console.log(
      "✅ ORDER_CANCELLED automation triggered",
      automationEvent.id
    );
  } catch (error) {
    console.error(
      "❌ ORDER_CANCELLED automation failed:",
      error.message
    );

    if (automationEvent) {
      try {
        await prisma.automationEvent.update({
          where: {
            id: automationEvent.id,
          },
          data: {
            retryCount: {
              increment: 1,
            },

            lastError:
              error.message,
          },
        });
      } catch (updateError) {
        console.error(
          "Failed to update automation event:",
          updateError.message
        );
      }
    }
  }
}

/* =====================================================
   🆔 GENERATE ORDER NUMBER
===================================================== */

function generateOrderNumber(orderId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `DRIP-${y}${m}${d}-${orderId}`;
}

function generateTemporaryOrderNumber() {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TMP-${now}-${rand}`;
}

function toSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toNullableDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeOrderItemInput(item) {
  const productId = item.product_id || item.productId;
  const quantity = toSafeNumber(item.quantity, 0);
  const unitPrice = toSafeNumber(item.unit_price ?? item.unitPrice, 0);

  if (!productId) {
    throw new Error("Each order item must have a productId");
  }

  if (quantity <= 0) {
    throw new Error(`Invalid quantity for product ${productId}`);
  }

  if (unitPrice < 0) {
    throw new Error(`Invalid unit price for product ${productId}`);
  }

  return {
    productId,
    quantity,
    unitPrice,
    selectedColor: item.selectedColor ?? null,
    selectedSize: item.selectedSize ?? null,
  };
}

async function reserveProductStock(tx, product, quantity) {
  if (!product) {
    throw new Error("Product not found");
  }

  if (product.stock !== null) {
    const updated = await tx.product.updateMany({
      where: {
        id: product.id,
        stock: {
          gte: quantity,
        },
      },
      data: {
        stock: {
          decrement: quantity,
        },
        sold: {
          increment: quantity,
        },
      },
    });

    if (updated.count === 0) {
      throw new Error(`Insufficient stock for product ${product.id}`);
    }

    return;
  }

  await tx.product.update({
    where: { id: product.id },
    data: {
      sold: {
        increment: quantity,
      },
    },
  });
}

async function reserveProductSizeStock(
  tx,
  productId,
  selectedSize,
  quantity
) {
  const productSize = await tx.productSize.findFirst({
    where: {
      productId,
      size: selectedSize,
    },
    select: {
      id: true,
      stock: true,
    },
  });

  if (!productSize) {
    throw new Error(`Size ${selectedSize} not found`);
  }

  const updated = await tx.productSize.updateMany({
    where: {
      id: productSize.id,
      stock: {
        gte: quantity,
      },
    },
    data: {
      stock: {
        decrement: quantity,
      },
    },
  });

  if (updated.count === 0) {
    throw new Error(`Insufficient stock for size ${selectedSize}`);
  }
}

function buildOrderItemView(item) {
  const images = parseImages(item.product?.images);
  return {
    id: item.productId,
    name: item.product?.name || null,
    image: images[0] || null,
    images,
    quantity: item.quantity,
    price: item.price,
    options: {
      color: item.selectedColor,
      size: item.selectedSize,
    },
  };
}

function buildShipmentView(shipment) {
  if (!shipment) return null;

  return {
    id: shipment.id,
    orderId: shipment.orderId,
    shiprocketOrderId: shipment.shiprocketOrderId,
    shipmentId: shipment.shipmentId,
    awbCode: shipment.awbCode,
    courierId: shipment.courierId,
    courierName: shipment.courierName,
    shipmentStatus: shipment.shipmentStatus,
    pickupScheduledAt: shipment.pickupScheduledAt,
    pickupTokenNumber: shipment.pickupTokenNumber,
    assignedAt: shipment.assignedAt,
    isReturn: shipment.isReturn,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
    trackingEvents: (shipment.trackingEvents || []).map((event) => ({
      id: event.id,
      shipmentId: event.shipmentId,
      status: event.status,
      activity: event.activity,
      location: event.location,
      scanTimestamp: event.scanTimestamp,
      createdAt: event.createdAt,
    })),
  };
}

function buildOrderView(order) {
  return {
    ...order,
    shipment: buildShipmentView(order.shipment),
    items: (order.items || []).map(buildOrderItemView),
  };
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
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Order items required");
  }

  const normalizedItems = items.map(normalizeOrderItemInput);

  return prisma.$transaction(async (tx) => {
    let computedTotal = 0;

    for (const item of normalizedItems) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stock: true, sold: true },
      });

      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (product.stock !== null && product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }

      if (item.selectedSize) {
  const productSize =
    await tx.productSize.findFirst({
      where: {
        productId: item.productId,
        size: item.selectedSize,
      },
      select: {
        id: true,
        stock: true,
      },
    });

  if (!productSize) {
    throw new Error(
      `Size ${item.selectedSize} not found`
    );
  }

  if (
    productSize.stock <
    item.quantity
  ) {
    throw new Error(
      `Insufficient stock for size ${item.selectedSize}`
    );
  }
}



      computedTotal += item.unitPrice * item.quantity;
    }

    const orderNumberPlaceholder = generateTemporaryOrderNumber();

    const finalTotal =
      computedTotal +
      (String(paymentMethod).toUpperCase() === "COD" ? 25 : 0);

    const order = await tx.order.create({
      data: {
        userId,
        orderNumber: orderNumberPlaceholder,
        addressId: shippingAddress?.id ?? null,
        shippingAddress: shippingAddress ?? {},
        paymentMethod: paymentMethod ?? null,
        paymentDetails: paymentDetails ?? {},
        totalAmount: finalTotal,
        status: "Confirmed",
        deliveryDate: toNullableDate(deliveryDate),
      },
    });

    const finalOrderNumber = generateOrderNumber(order.id);

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { orderNumber: finalOrderNumber },
    });

    await tx.shipment.create({
      data: {
        orderId: updatedOrder.id,
        shipmentStatus: "Confirmed",
      },
    });

    for (const item of normalizedItems) {
      const lineTotal = item.unitPrice * item.quantity;

      await tx.orderItem.create({
        data: {
          orderId: updatedOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          price: lineTotal,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
        },
      });

      const existingProduct = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stock: true, sold: true },
      });

      if (!existingProduct) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (item.selectedSize) {
  await reserveProductSizeStock(
    tx,
    item.productId,
    item.selectedSize,
    item.quantity
  );
}

await reserveProductStock(
  tx,
  existingProduct,
  item.quantity
);
    }

    await tx.cartItem.deleteMany({
      where: { userId },
    });

    return {
      orderId: updatedOrder.id,
      orderNumber: finalOrderNumber,
    };
  });
}

/* =====================================================
   🚚 ATTACH / UPSERT SHIPMENT
===================================================== */

export async function attachShipmentToOrderService({
  orderId,
  shiprocketOrderId = null,
  shipmentId = null,
  awbCode = null,
  courierId = null,
  courierName = null,
  shipmentStatus = null,
  pickupScheduledAt = null,
  pickupTokenNumber = null,
  assignedAt = null,
  isReturn = false,
}) {
  if (!orderId) {
    throw new Error("orderId is required");
  }

  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true },
  });

  if (!existingOrder) {
    throw new Error("Order not found");
  }

  const existingShipment = await prisma.shipment.findUnique({
    where: { orderId },
  });

  const shipmentData = {
    shiprocketOrderId:
      shiprocketOrderId !== null && shiprocketOrderId !== undefined
        ? String(shiprocketOrderId)
        : existingShipment?.shiprocketOrderId,
    shipmentId:
      shipmentId !== null && shipmentId !== undefined
        ? String(shipmentId)
        : existingShipment?.shipmentId,
    awbCode:
      awbCode !== null && awbCode !== undefined
        ? String(awbCode)
        : existingShipment?.awbCode,
    courierId:
      courierId !== null && courierId !== undefined
        ? Number(courierId)
        : existingShipment?.courierId,
    courierName:
      courierName !== null && courierName !== undefined
        ? courierName
        : existingShipment?.courierName,
    shipmentStatus:
      shipmentStatus !== null && shipmentStatus !== undefined
        ? shipmentStatus
        : existingShipment?.shipmentStatus,
    pickupScheduledAt:
      pickupScheduledAt !== null && pickupScheduledAt !== undefined
        ? toNullableDate(pickupScheduledAt)
        : existingShipment?.pickupScheduledAt,
    pickupTokenNumber:
      pickupTokenNumber !== null && pickupTokenNumber !== undefined
        ? pickupTokenNumber
        : existingShipment?.pickupTokenNumber,
    assignedAt:
      assignedAt !== null && assignedAt !== undefined
        ? toNullableDate(assignedAt)
        : existingShipment?.assignedAt,
    isReturn:
      isReturn !== null && isReturn !== undefined
        ? Boolean(isReturn)
        : existingShipment?.isReturn ?? false,
  };

  if (existingShipment) {
    await prisma.shipment.update({
      where: { orderId },
      data: shipmentData,
    });

    return true;
  }

  await prisma.shipment.create({
    data: {
      orderId,
      ...shipmentData,
    },
  });

  return true;
}

/* =====================================================
   🚚 UPDATE SHIPMENT STATUS + TRACKING EVENT
===================================================== */

export async function updateOrderShipmentStatusService({
  orderId,
  shipmentStatus,
  awbCode = null,
  courierName = null,
  courierId = null,
  shiprocketOrderId = null,
  shipmentId = null,
  activity = null,
  location = null,
  scanTimestamp = null,
}) {
  const orderStatusMap = {
    NEW: "Confirmed",
    CONFIRMED: "Confirmed",
    PICKUP_SCHEDULED: "Confirmed",
    PICKED_UP: "Packed",
    IN_TRANSIT: "Shipped",
    SHIPPED: "Shipped",
    OUT_FOR_DELIVERY: "Out For Delivery",
    DELIVERED: "Delivered",
    RTO_INITIATED: "RTO Initiated",
    RTO_DELIVERED: "RTO Delivered",
    CANCELLED: "Cancelled",
  };

  if (!orderId) {
    throw new Error("orderId is required");
  }

  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true },
  });

  if (!existingOrder) {
    throw new Error("Order not found");
  }

  const shipment = await prisma.shipment.findUnique({
    where: { orderId },
  });

  if (!shipment) {
    throw new Error("Shipment not found for this order");
  }

  const updatedShipment = await prisma.shipment.update({
    where: { orderId },
    data: {
      shipmentStatus: shipmentStatus ?? shipment.shipmentStatus,
      awbCode: awbCode !== null ? String(awbCode) : shipment.awbCode,
      courierName: courierName ?? shipment.courierName,
      courierId:
        courierId !== null && courierId !== undefined
          ? Number(courierId)
          : shipment.courierId,
      shiprocketOrderId:
        shiprocketOrderId !== null
          ? String(shiprocketOrderId)
          : shipment.shiprocketOrderId,
      shipmentId:
        shipmentId !== null ? String(shipmentId) : shipment.shipmentId,
    },
  });

  if (shipmentStatus || activity || location || scanTimestamp) {
    await prisma.shipmentTracking.create({
      data: {
        shipmentId: updatedShipment.id,
        status: shipmentStatus ?? updatedShipment.shipmentStatus ?? "Unknown",
        activity: activity ?? shipmentStatus ?? "Shipment updated",
        location: location ?? null,
        scanTimestamp: toNullableDate(scanTimestamp),
      },
    });
  }

  const mappedOrderStatus = shipmentStatus
    ? orderStatusMap[String(shipmentStatus).toUpperCase()]
    : null;

  if (mappedOrderStatus) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: mappedOrderStatus },
    });
  }

  return updatedShipment;
}

/* =====================================================
   📦 GET USER ORDERS
===================================================== */

export async function getUserOrdersService(userId, { page = 1, limit = 10, status }) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const currentPage = Number(page) || 1;
  const pageLimit = Number(limit) || 10;
  const skip = (currentPage - 1) * pageLimit;

  const where = { userId };

  if (status) {
    where.status = {
      equals: status,
      mode: "insensitive",
    };
  }

  const orders = await prisma.order.findMany({
    where,
    skip,
    take: pageLimit,
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: { product: true },
      },
      shipment: {
        include: {
          trackingEvents: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      address: true,
    },
  });

  return orders.map(buildOrderView);
}

/* =====================================================
   📦 GET SINGLE ORDER
===================================================== */

export async function getOrderByIdService(userId, orderId) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
    },
    include: {
      items: {
        include: { product: true },
      },
      shipment: {
        include: {
          trackingEvents: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      address: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  return buildOrderView(order);
}

/* =====================================================
   ❌ CANCEL ORDER
===================================================== */

export async function cancelOrderService(userId, orderId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: true,
      shipment: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }
  if (
  String(order.status)
    .toLowerCase() ===
  "cancelled"
) {
  throw new Error(
    "Order already cancelled"
  );
}

  const allowedStatuses = ["pending", "confirmed", "packed", "shipped"];

  if (!allowedStatuses.includes(String(order.status || "").toLowerCase())) {
    throw new Error("Order cannot be cancelled");
  }

  let cancelledOrder;

  await prisma.$transaction(async (tx) => {
    cancelledOrder = await tx.order.update({
      where: { id: orderId },
      data: { status: "Cancelled" },
    });

    if (order.shipment) {
      await tx.shipment.update({
        where: { orderId },
        data: { shipmentStatus: "Cancelled" },
      });

      await tx.shipmentTracking.create({
        data: {
          shipmentId: order.shipment.id,
          status: "Cancelled",
          activity: "Order cancelled by user",
          location: null,
          scanTimestamp: new Date(),
        },
      });
    }

    for (const item of order.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stock: true, sold: true },
      });

      if (!product) continue;

      const cancelData = {
        sold: Math.max(0, (product.sold || 0) - item.quantity),
      };

      if (product.stock !== null) {
        cancelData.stock = {
          increment: item.quantity,
        };
      }

      await tx.product.update({
        where: { id: item.productId },
        data: cancelData,
      });

      if (item.selectedSize) {
        await tx.productSize.updateMany({
          where: {
            productId: item.productId,
            size: item.selectedSize,
          },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }
    }
  });

  try {
    await queueOrderCancelledEvent({
      order: {
        ...order,
        ...cancelledOrder,
      },
      userId,
    });
  } catch (error) {
    console.error("Failed to trigger ORDER_CANCELLED automation:", error);
  }

  return true;
}

/* =====================================================
   🔁 REORDER
===================================================== */

export async function reorderService(userId, orderId) {
  const oldOrder = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });

  if (!oldOrder) {
    throw new Error("Order not found");
  }

  if (!oldOrder.items.length) {
    throw new Error("No items to reorder");
  }

  const normalizedItems = oldOrder.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    selectedColor: item.selectedColor,
    selectedSize: item.selectedSize,
  }));

  return prisma.$transaction(async (tx) => {
    for (const item of normalizedItems) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stock: true, sold: true },
      });

      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (product.stock !== null && product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }

      if (item.selectedSize) {
  const productSize =
    await tx.productSize.findFirst({
      where: {
        productId: item.productId,
        size: item.selectedSize,
      },
      select: {
        id: true,
        stock: true,
      },
    });

  if (!productSize) {
    throw new Error(
      `Size ${item.selectedSize} not found`
    );
  }

  if (
    productSize.stock <
    item.quantity
  ) {
    throw new Error(
      `Insufficient stock for size ${item.selectedSize}`
    );
  }
}


    const orderNumberPlaceholder = generateTemporaryOrderNumber();

    const newOrder = await tx.order.create({
      data: {
        userId,
        orderNumber: orderNumberPlaceholder,
        totalAmount: oldOrder.totalAmount,
        status: "Confirmed",
        paymentMethod: oldOrder.paymentMethod,
        paymentDetails: oldOrder.paymentDetails,
        shippingAddress: oldOrder.shippingAddress,
        addressId: oldOrder.addressId,
        deliveryDate: oldOrder.deliveryDate,
      },
    });

    const finalOrderNumber = generateOrderNumber(newOrder.id);

    const updatedOrder = await tx.order.update({
      where: { id: newOrder.id },
      data: { orderNumber: finalOrderNumber },
    });

    await tx.shipment.create({
      data: {
        orderId: updatedOrder.id,
        shipmentStatus: "Confirmed",
      },
    });

    for (const item of normalizedItems) {
      await tx.orderItem.create({
        data: {
          orderId: updatedOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          price: item.unitPrice * item.quantity,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
        },
      });

      const existingProduct = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stock: true, sold: true },
      });

      if (!existingProduct) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (item.selectedSize) {
  await reserveProductSizeStock(
    tx,
    item.productId,
    item.selectedSize,
    item.quantity
  );
}

await reserveProductStock(
  tx,
  existingProduct,
  item.quantity
);
    }

    return {
      orderId: updatedOrder.id,
      orderNumber: finalOrderNumber,
    };
  });
}
