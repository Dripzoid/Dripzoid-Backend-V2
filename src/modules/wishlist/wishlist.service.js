import prisma from "../../lib/prisma.js";

import {
  parseImages,
} from "../products/product.utils.js";

/* =====================================================
   📦 GET USER WISHLIST
===================================================== */

export async function getWishlistService(
  userId
) {
  /* =========================
     FETCH WISHLIST ITEMS
  ========================= */

  const wishlistItems =
    await prisma.wishlistItem.findMany({
      where: {
        userId,
      },

      include: {
        product: true,
      },

      orderBy: {
        createdAt:
          "desc",
      },
    });

  /* =========================
     FORMAT RESPONSE
  ========================= */

  return wishlistItems.map(
    (item) => ({
      id:
        item.id,

      product_id:
        item.productId,

      name:
        item.product
          ?.name ||
        null,

      price:
        item.product
          ?.price ||
        0,

      images:
        parseImages(
          item.product
            ?.images
        ),

      created_at:
        item.createdAt,
    })
  );
}

/* =====================================================
   ➕ ADD SINGLE
===================================================== */

export async function addWishlistItemService({
  userId,
  productId,
}) {
  /* =========================
     CHECK PRODUCT
  ========================= */

  const product =
    await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

  if (!product) {
    throw new Error(
      "product_not_found"
    );
  }

  /* =========================
     CHECK EXISTING
  ========================= */

  const existingItem =
    await prisma.wishlistItem.findFirst({
      where: {
        userId,

        productId,
      },
    });

  if (existingItem) {
    return {
      id:
        existingItem.id,

      alreadyExists:
        true,
    };
  }

  /* =========================
     CREATE WISHLIST ITEM
  ========================= */

  const wishlistItem =
    await prisma.wishlistItem.create({
      data: {
        userId,

        productId,
      },
    });

  return {
    id:
      wishlistItem.id,
  };
}

/* =====================================================
   ➕ BULK ADD
===================================================== */

export async function bulkAddWishlistService({
  userId,
  productIds,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !Array.isArray(
      productIds
    ) ||
    !productIds.length
  ) {
    throw new Error(
      "invalid_product_ids"
    );
  }

  /* =========================
     FILTER EXISTING
  ========================= */

  const existingItems =
    await prisma.wishlistItem.findMany({
      where: {
        userId,

        productId: {
          in: productIds,
        },
      },

      select: {
        productId:
          true,
      },
    });

  const existingIds =
    existingItems.map(
      (item) =>
        item.productId
    );

  const newProductIds =
    productIds.filter(
      (id) =>
        !existingIds.includes(
          id
        )
    );

  /* =========================
     CREATE MANY
  ========================= */

  if (
    newProductIds.length >
    0
  ) {
    await prisma.wishlistItem.createMany(
      {
        data:
          newProductIds.map(
            (
              productId
            ) => ({
              userId,

              productId,
            })
          ),

        skipDuplicates:
          true,
      }
    );
  }

  return true;
}

/* =====================================================
   ❌ REMOVE SINGLE
===================================================== */

export async function removeWishlistItemService({
  userId,
  productId,
}) {
  /* =========================
     DELETE ITEM
  ========================= */

  const result =
    await prisma.wishlistItem.deleteMany({
      where: {
        userId,

        productId,
      },
    });

  return {
    deleted:
      result.count,
  };
}

/* =====================================================
   ❌ BULK REMOVE
===================================================== */

export async function bulkRemoveWishlistService({
  userId,
  productIds,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !Array.isArray(
      productIds
    ) ||
    !productIds.length
  ) {
    throw new Error(
      "invalid_product_ids"
    );
  }

  /* =========================
     DELETE ITEMS
  ========================= */

  const result =
    await prisma.wishlistItem.deleteMany({
      where: {
        userId,

        productId: {
          in: productIds,
        },
      },
    });

  return {
    deleted:
      result.count,
  };
}

/* =====================================================
   🔄 MOVE WISHLIST TO CART
===================================================== */

export async function moveWishlistToCartService({
  userId,
  productIds,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !Array.isArray(
      productIds
    ) ||
    !productIds.length
  ) {
    throw new Error(
      "invalid_product_ids"
    );
  }

  /* =========================
     TRANSACTION
  ========================= */

  await prisma.$transaction(
    async (tx) => {
      for (const productId of productIds) {
        /* =====================
           CHECK CART ITEM
        ===================== */

        const existingCartItem =
          await tx.cartItem.findFirst(
            {
              where: {
                userId,

                productId,
              },
            }
          );

        /* =====================
           ADD TO CART
        ===================== */

        if (
          !existingCartItem
        ) {
          await tx.cartItem.create(
            {
              data: {
                userId,

                productId,

                quantity:
                  1,
              },
            }
          );
        }

        /* =====================
           REMOVE WISHLIST ITEM
        ===================== */

        await tx.wishlistItem.deleteMany(
          {
            where: {
              userId,

              productId,
            },
          }
        );
      }
    }
  );

  return true;
}