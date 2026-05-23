import prisma from "../../lib/prisma.js";

import {
  parseImages,
} from "../products/product.utils.js";

import {
  validateUserCart,
} from "./cart.validation.js";

/* ======================================================
   GET USER CART
====================================================== */

export async function getUserCartService(
  userId
) {
  /* =========================
     VALIDATE CART
  ========================= */

  await validateUserCart(
    userId
  );

  const cartItems =
    await prisma.cartItem.findMany({
      where: {
        userId,
      },

      include: {
        product: {
          include: {
            sizes: true,
          },
        },
      },

      orderBy: {
        addedAt: "desc",
      },
    });

  return cartItems.map(
    (item) => ({
      cart_id: item.id,

      product_id:
        item.productId,

      quantity:
        item.quantity,

      selectedSize:
        item.size,

      selectedColor:
        item.color,

      name:
        item.product?.name,

      price:
        item.product?.price,

      images:
        parseImages(
          item.product?.images
        ),

      stock:
        item.size
          ? Number(
              item.product?.sizes?.find(
                (size) =>
                  String(
                    size.size
                  ).toLowerCase() ===
                  String(
                    item.size
                  ).toLowerCase()
              )?.stock || 0
            )
          : Number(
              item.product?.stock ||
                0
            ),
    })
  );
}

/* ======================================================
   GET CART BY USER ID
====================================================== */

export async function getCartByUserIdService(
  requestedUserId,
  loggedInUserId
) {
  if (
    String(requestedUserId) !==
    String(loggedInUserId)
  ) {
    throw new Error(
      "Forbidden"
    );
  }

  /* =========================
     VALIDATE CART
  ========================= */

  await validateUserCart(
    requestedUserId
  );

  const cartItems =
    await prisma.cartItem.findMany({
      where: {
        userId:
          requestedUserId,
      },

      include: {
        product: {
          include: {
            sizes: true,
          },
        },
      },

      orderBy: {
        addedAt: "desc",
      },
    });

  return cartItems.map(
    (item) => ({
      id: item.id,

      product_id:
        item.productId,

      quantity:
        item.quantity,

      size: item.size,

      color: item.color,

      product_name:
        item.product?.name,

      price:
        item.product?.price,

      stock:
        item.size
          ? Number(
              item.product?.sizes?.find(
                (size) =>
                  String(
                    size.size
                  ).toLowerCase() ===
                  String(
                    item.size
                  ).toLowerCase()
              )?.stock || 0
            )
          : Number(
              item.product?.stock ||
                0
            ),
    })
  );
}

/* ======================================================
   ADD TO CART
====================================================== */

export async function addToCartService({
  userId,
  product_id,
  quantity = 1,
  selectedSize = null,
  selectedColor = null,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (!product_id) {
    throw new Error(
      "Missing product_id"
    );
  }

  if (quantity <= 0) {
    throw new Error(
      "Invalid quantity"
    );
  }

  /* =========================
     CHECK PRODUCT
  ========================= */

  const product =
    await prisma.product.findUnique({
      where: {
        id: product_id,
      },

      include: {
        sizes: true,
      },
    });

  if (!product) {
    throw new Error(
      `Product not found: ${product_id}`
    );
  }

  /* =========================
     SIZE VALIDATION
  ========================= */

  let sizeStock = null;

  if (selectedSize) {
    const sizeRow =
      product.sizes.find(
        (size) =>
          String(
            size.size
          ).toLowerCase() ===
          String(
            selectedSize
          ).toLowerCase()
      );

    if (!sizeRow) {
      throw new Error(
        "Selected size not available"
      );
    }

    sizeStock =
      Number(
        sizeRow.stock || 0
      );

    if (sizeStock <= 0) {
      throw new Error(
        "Selected size out of stock"
      );
    }
  }

  /* =========================
     CHECK EXISTING CART ITEM
  ========================= */

  const existingCartItem =
    await prisma.cartItem.findFirst({
      where: {
        userId,

        productId:
          product_id,

        size:
          selectedSize,

        color:
          selectedColor,
      },
    });

  /* =========================
     STOCK VALIDATION
  ========================= */

  const currentQty =
    existingCartItem?.quantity ||
    0;

  const finalQty =
    currentQty + quantity;

  const availableStock =
    selectedSize
      ? sizeStock
      : Number(
          product.stock || 0
        );

  if (
    finalQty >
    availableStock
  ) {
    throw new Error(
      `Only ${availableStock} items available in stock`
    );
  }

  /* =========================
     UPDATE EXISTING
  ========================= */

  if (existingCartItem) {
    const updatedItem =
      await prisma.cartItem.update({
        where: {
          id:
            existingCartItem.id,
        },

        data: {
          quantity: finalQty,
        },
      });

    return {
      id: updatedItem.id,

      updated: true,
    };
  }

  /* =========================
     CREATE CART ITEM
  ========================= */

  const cartItem =
    await prisma.cartItem.create({
      data: {
        userId,

        productId:
          product_id,

        size:
          selectedSize,

        color:
          selectedColor,

        quantity,
      },
    });

  return {
    id: cartItem.id,

    created: true,
  };
}

/* ======================================================
   UPDATE CART ITEM
====================================================== */

export async function updateCartItemService({
  cartId,
  userId,
  quantity,
}) {
  if (quantity <= 0) {
    throw new Error(
      "Invalid quantity"
    );
  }

  /* =========================
     CHECK CART ITEM
  ========================= */

  const cartItem =
    await prisma.cartItem.findFirst({
      where: {
        id: cartId,

        userId,
      },

      include: {
        product: {
          include: {
            sizes: true,
          },
        },
      },
    });

  if (!cartItem) {
    throw new Error(
      "Cart item not found"
    );
  }

  /* =========================
     STOCK CHECK
  ========================= */

  let availableStock =
    Number(
      cartItem.product?.stock ||
        0
    );

  if (cartItem.size) {
    const sizeRow =
      cartItem.product.sizes.find(
        (size) =>
          String(
            size.size
          ).toLowerCase() ===
          String(
            cartItem.size
          ).toLowerCase()
      );

    if (!sizeRow) {
      throw new Error(
        "Selected size unavailable"
      );
    }

    availableStock =
      Number(
        sizeRow.stock || 0
      );
  }

  if (
    quantity >
    availableStock
  ) {
    throw new Error(
      `Only ${availableStock} items available in stock`
    );
  }

  /* =========================
     UPDATE CART ITEM
  ========================= */

  const updatedItem =
    await prisma.cartItem.update({
      where: {
        id: cartId,
      },

      data: {
        quantity,
      },
    });

  return {
    updated: true,

    item: updatedItem,
  };
}

/* ======================================================
   DELETE CART ITEM
====================================================== */

export async function deleteCartItemService({
  cartId,
  userId,
}) {
  const cartItem =
    await prisma.cartItem.findFirst({
      where: {
        id: cartId,

        userId,
      },
    });

  if (!cartItem) {
    throw new Error(
      "Cart item not found"
    );
  }

  await prisma.cartItem.delete({
    where: {
      id: cartId,
    },
  });

  return {
    deleted: true,
  };
}

/* ======================================================
   CLEAR CART
====================================================== */

export async function clearCartService(
  userId
) {
  const result =
    await prisma.cartItem.deleteMany({
      where: {
        userId,
      },
    });

  return {
    cleared:
      result.count,
  };
}