import prisma from "../../lib/prisma.js";

export async function validateUserCart(
  userId
) {
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
    });

  for (const item of cartItems) {
    let availableStock =
      Number(
        item.product?.stock || 0
      );

    /* =========================
       SIZE STOCK
    ========================= */

    if (item.size) {
      const sizeRow =
        item.product.sizes.find(
          (size) =>
            String(
              size.size
            ).toLowerCase() ===
            String(
              item.size
            ).toLowerCase()
        );

      availableStock =
        Number(
          sizeRow?.stock || 0
        );
    }

    /* =========================
       OUT OF STOCK
    ========================= */

    if (availableStock <= 0) {
      await prisma.cartItem.delete({
        where: {
          id: item.id,
        },
      });

      continue;
    }

    /* =========================
       REDUCE QUANTITY
    ========================= */

    if (
      item.quantity >
      availableStock
    ) {
      await prisma.cartItem.update({
        where: {
          id: item.id,
        },

        data: {
          quantity:
            availableStock,
        },
      });
    }
  }
}