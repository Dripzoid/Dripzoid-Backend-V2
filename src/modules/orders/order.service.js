import prisma from "../../lib/prisma.js";
import { parseImages } from "../products/product.utils.js";
import { triggerAutomationEvent } from "../../integrations/automation/automation.service.js";
import { EVENT_TYPES } from "../../config/eventTypes.js";
import { AppError } from "../../errors/AppError.js";

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

export function generateOrderNumber(orderId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `DRIP-${y}${m}${d}-${orderId}`;
}

export function generateTemporaryOrderNumber() {
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

let transactionSupportVerified = null;

export function setTransactionSupportForTesting(val) {
  transactionSupportVerified = val;
}

export function resetTransactionSupportCache() {
  transactionSupportVerified = null;
}

/**
 * Checks whether the configured database deployment supports transactions.
 * Tests with a minimal no-op probe to avoid side effects or data loss.
 */
export async function isTransactionSupported(db = prisma) {
  if (transactionSupportVerified !== null) {
    return transactionSupportVerified;
  }

  if (typeof db?.$transaction !== "function") {
    transactionSupportVerified = false;
    return false;
  }

  try {
    await db.$transaction(async () => true);
    transactionSupportVerified = true;
    return true;
  } catch (err) {
    const msg = String(err?.message || "");
    if (
      err?.code === "P2010" ||
      msg.includes("Transactions are not supported") ||
      msg.includes("replica set")
    ) {
      console.warn("⚠️ Database deployment does not support transactions. Operating in safe non-transactional mode.");
      transactionSupportVerified = false;
      return false;
    }
    // For non-deployment errors (e.g. temporary network blips), rethrow
    throw err;
  }
}

/**
 * Execute action in a Prisma transaction if supported, or directly on the database client.
 * If a transaction is supported and fails, it is aborted and rolled back by the database engine.
 * Under NO circumstances is a failed transaction callback rerun outside the transaction.
 */
export async function executeWithTransaction(action, db = prisma) {
  const supported = await isTransactionSupported(db);

  if (supported) {
    return await db.$transaction(async (tx) => {
      return await action(tx);
    });
  }

  return await action(db);
}

function normalizeOrderItemInput(item) {
  const productId = item.product_id || item.productId;
  const quantity = toSafeNumber(item.quantity, 0);
  const unitPrice = toSafeNumber(item.unit_price ?? item.unitPrice ?? item.price, 0);

  if (!productId) {
    throw new AppError("Each order item must have a productId", 400);
  }

  if (quantity <= 0) {
    throw new AppError(`Invalid quantity for product ${productId}`, 400);
  }

  if (unitPrice < 0) {
    throw new AppError(`Invalid unit price for product ${productId}`, 400);
  }

  return {
    productId,
    quantity,
    unitPrice,
    selectedColor: item.selectedColor ?? null,
    selectedSize: item.selectedSize ?? null,
  };
}

export async function reserveProductStock(tx, product, quantity) {
  if (!product || !product.id) {
    throw new AppError("Product is required for stock reservation", 400);
  }

  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    throw new AppError(`Invalid reservation quantity for product ${product.id}`, 400);
  }

  if (product.stock !== null && product.stock !== undefined) {
    const updated = await tx.product.updateMany({
      where: {
        id: product.id,
        stock: {
          gte: qty,
        },
      },
      data: {
        stock: {
          decrement: qty,
        },
        sold: {
          increment: qty,
        },
      },
    });

    if (updated.count === 0) {
      throw new AppError(
        `Insufficient stock for product "${product.name || product.id}". Available: ${product.stock}, requested: ${qty}`,
        409
      );
    }

    return { productId: product.id, quantity: qty };
  }

  const updated = await tx.product.updateMany({
    where: { id: product.id },
    data: {
      sold: {
        increment: qty,
      },
    },
  });

  if (updated.count === 0) {
    throw new AppError(`Product ${product.id} not found`, 404);
  }

  return { productId: product.id, quantity: qty };
}

export async function reserveProductSizeStock(
  tx,
  productId,
  selectedSize,
  quantity
) {
  if (!selectedSize) return null;

  if (!productId) {
    throw new AppError("productId is required for size stock reservation", 400);
  }

  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    throw new AppError(`Invalid size reservation quantity for product ${productId}`, 400);
  }

  const productSizes = await tx.productSize.findMany({
    where: { productId },
    select: {
      id: true,
      size: true,
      stock: true,
    },
  });

  if (!productSizes || productSizes.length === 0) {
    throw new AppError(
      `Product ${productId} does not have size options configured, but size "${selectedSize}" was requested`,
      400
    );
  }

  const reqSize = String(selectedSize).trim().toLowerCase();
  const matched = productSizes.find(
    (ps) => ps.size && ps.size.trim().toLowerCase() === reqSize
  );

  if (!matched) {
    throw new AppError(
      `Size "${selectedSize}" not found for product ${productId}`,
      400
    );
  }

  const anySizeHasStock = productSizes.some((ps) => (ps.stock || 0) > 0);

  if (anySizeHasStock) {
    const updated = await tx.productSize.updateMany({
      where: {
        id: matched.id,
        stock: {
          gte: qty,
        },
      },
      data: {
        stock: {
          decrement: qty,
        },
      },
    });

    if (updated.count === 0) {
      throw new AppError(
        `Insufficient stock for size "${matched.size}". Available: ${matched.stock}, requested: ${qty}`,
        409
      );
    }

    return { productSizeId: matched.id, size: matched.size, quantity: qty };
  }

  // Legacy catalog support where size labels exist with default 0 stock, but master product.stock is tracked
  return { productSizeId: matched.id, size: matched.size, quantity: 0 };
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

async function executeOrderCreation(tx, {
  userId,
  normalizedItems,
  shippingAddress,
  paymentMethod,
  paymentDetails,
  deliveryDate,
  onProgress,
}) {
  let computedTotal = 0;

  for (const item of normalizedItems) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { id: true, stock: true, sold: true, name: true },
    });

    if (!product) {
      throw new AppError(`Product ${item.productId} not found`, 404);
    }

    if (product.stock !== null && product.stock < item.quantity) {
      throw new AppError(
        `Insufficient stock for product "${product.name || item.productId}". Available: ${product.stock}, requested: ${item.quantity}`,
        409
      );
    }

    if (item.selectedSize) {
      const productSizes = await tx.productSize.findMany({
        where: { productId: item.productId },
        select: { id: true, size: true, stock: true },
      });

      if (!productSizes || productSizes.length === 0) {
        throw new AppError(
          `Product "${product.name || item.productId}" does not have size options configured, but size "${item.selectedSize}" was requested`,
          400
        );
      }

      const reqSize = String(item.selectedSize).trim().toLowerCase();
      const matched = productSizes.find(
        (ps) => ps.size && ps.size.trim().toLowerCase() === reqSize
      );

      const anySizeHasStock = productSizes.some(
        (ps) => (ps.stock || 0) > 0
      );

      if (!matched) {
        throw new AppError(
          `Size "${item.selectedSize}" not found for product "${product.name || item.productId}"`,
          400
        );
      } else if (anySizeHasStock) {
        if ((matched.stock || 0) < item.quantity) {
          throw new AppError(
            `Insufficient stock for size "${matched.size}". Available: ${matched.stock}, requested: ${item.quantity}`,
            409
          );
        }
      }
    }

    computedTotal += item.unitPrice * item.quantity;
  }

  const orderNumberPlaceholder = generateTemporaryOrderNumber();

  const finalTotal =
    computedTotal +
    (String(paymentMethod).toUpperCase() === "COD" ? 25 : 0);

  // Validate if shippingAddress.id actually exists in Address table to avoid relation constraint failures
  let validAddressId = null;
  if (shippingAddress?.id) {
    try {
      const existingAddress = await tx.address.findFirst({
        where: {
          id: String(shippingAddress.id).trim(),
          userId,
        },
        select: { id: true },
      });
      if (existingAddress) {
        validAddressId = existingAddress.id;
      }
    } catch (addrErr) {
      console.warn("⚠️ Could not verify addressId relation:", addrErr.message);
    }
  }

  const order = await tx.order.create({
    data: {
      userId,
      orderNumber: orderNumberPlaceholder,
      addressId: validAddressId,
      shippingAddress: shippingAddress ?? {},
      paymentMethod: paymentMethod ?? null,
      paymentDetails: paymentDetails ?? {},
      totalAmount: finalTotal,
      status: "Confirmed",
      deliveryDate: toNullableDate(deliveryDate),
    },
  });

  if (onProgress) {
    onProgress({ type: "orderCreated", orderId: order.id });
  }

  const finalOrderNumber = generateOrderNumber(order.id);

  const updatedOrder = await tx.order.update({
    where: { id: order.id },
    data: { orderNumber: finalOrderNumber },
  });

  for (const item of normalizedItems) {
    const lineTotal = item.unitPrice * item.quantity;

    const orderItem = await tx.orderItem.create({
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

    if (onProgress) {
      onProgress({ type: "orderItemCreated", orderItemId: orderItem.id });
    }

    const existingProduct = await tx.product.findUnique({
      where: { id: item.productId },
      select: { id: true, stock: true, sold: true, name: true },
    });

    if (!existingProduct) {
      throw new AppError(`Product ${item.productId} not found`, 404);
    }

    if (item.selectedSize) {
      const sizeReservation = await reserveProductSizeStock(
        tx,
        item.productId,
        item.selectedSize,
        item.quantity
      );
      if (onProgress && sizeReservation?.productSizeId && sizeReservation.quantity > 0) {
        onProgress({
          type: "sizeStockReserved",
          productSizeId: sizeReservation.productSizeId,
          quantity: sizeReservation.quantity,
        });
      }
    }

    const prodReservation = await reserveProductStock(
      tx,
      existingProduct,
      item.quantity
    );
    if (onProgress && prodReservation?.productId) {
      onProgress({
        type: "productStockReserved",
        productId: prodReservation.productId,
        quantity: prodReservation.quantity,
      });
    }
  }

  // Clear cart only after all items and inventory decrements succeeded
  try {
    await tx.cartItem.deleteMany({
      where: { userId },
    });
  } catch (cartErr) {
    console.warn("⚠️ Could not clear cart after order:", cartErr.message);
  }

  return {
    orderId: updatedOrder.id,
    orderNumber: finalOrderNumber,
  };
}

export async function createOrderService(
  {
    userId,
    items,
    shippingAddress,
    paymentMethod,
    paymentDetails,
    totalAmount,
    deliveryDate,
  },
  deps = {}
) {
  const db = deps.prisma || prisma;

  if (!userId) {
    throw new AppError("userId is required", 401);
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError("Order items required", 400);
  }

  const normalizedItems = items.map(normalizeOrderItemInput);

  const supported = await isTransactionSupported(db);

  if (supported) {
    // When transactions are supported, execute inside transaction.
    // Database engine guarantees atomic abort and rollback on error.
    // NEVER catch the error and retry outside transaction!
    return await db.$transaction(async (tx) => {
      return await executeOrderCreation(tx, {
        userId,
        normalizedItems,
        shippingAddress,
        paymentMethod,
        paymentDetails,
        deliveryDate,
      });
    });
  }

  // Explicit compensating recovery strategy for deployments without transaction support
  let createdOrderId = null;
  const createdOrderItemIds = [];
  const reservedStockOps = [];

  const onProgress = (evt) => {
    if (evt.type === "orderCreated") {
      createdOrderId = evt.orderId;
    } else if (evt.type === "orderItemCreated") {
      createdOrderItemIds.push(evt.orderItemId);
    } else if (evt.type === "sizeStockReserved") {
      reservedStockOps.push({ type: "size", id: evt.productSizeId, quantity: evt.quantity });
    } else if (evt.type === "productStockReserved") {
      reservedStockOps.push({ type: "product", id: evt.productId, quantity: evt.quantity });
    }
  };

  try {
    return await executeOrderCreation(db, {
      userId,
      normalizedItems,
      shippingAddress,
      paymentMethod,
      paymentDetails,
      deliveryDate,
      onProgress,
    });
  } catch (err) {
    console.warn("⚠️ Order creation failed in non-transactional mode. Executing compensating rollback:", err.message);

    // 1. Rollback reserved stock in reverse order
    for (const op of reservedStockOps.reverse()) {
      try {
        if (op.type === "size") {
          await db.productSize.update({
            where: { id: op.id },
            data: { stock: { increment: op.quantity } },
          });
        } else if (op.type === "product") {
          await db.product.update({
            where: { id: op.id },
            data: {
              stock: { increment: op.quantity },
              sold: { decrement: op.quantity },
            },
          });
        }
      } catch (stockRollbackErr) {
        console.error(`⚠️ Failed to compensate stock for ${op.type} ${op.id}:`, stockRollbackErr.message);
      }
    }

    // 2. Rollback created order items
    if (createdOrderId) {
      try {
        await db.orderItem.deleteMany({
          where: { orderId: createdOrderId },
        });
      } catch (itemDelErr) {
        console.error("⚠️ Failed to delete order items during compensation:", itemDelErr.message);
      }

      // 3. Rollback created order
      try {
        await db.order.delete({
          where: { id: createdOrderId },
        });
      } catch (orderDelErr) {
        console.error("⚠️ Failed to delete order during compensation:", orderDelErr.message);
      }
    }

    throw err;
  }
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
