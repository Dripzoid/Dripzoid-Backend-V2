import prisma from "../../../lib/prisma.js";

import {
  parseImages,
} from "../../products/product.utils.js";

/* =====================================================
   🔥 PUBLIC SALES
===================================================== */

export async function getPublicSalesService({
  limit = 10,
  productsPerSale = 12,
}) {
  const sales =
    await prisma.sale.findMany({
      where: {
        isDeleted: false,

        enabled: true,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: Number(limit),

      include: {
        saleProducts: {
          orderBy: {
            position: "asc",
          },

          take: Number(
            productsPerSale
          ),

          include: {
            product: true,
          },
        },
      },
    });

  return sales.map((sale) => {
    const products =
      sale.saleProducts.map(
        ({ product }) => {
          const images =
            parseImages(
              product.images
            );

          return {
            id: product.id,

            name:
              product.name,

            price:
              product.price !==
              null
                ? Number(
                    product.price
                  )
                : null,

            originalPrice:
              product.originalPrice !==
              null
                ? Number(
                    product.originalPrice
                  )
                : null,

            images,

            thumbnail:
              images[0] ||
              null,
          };
        }
      );

    return {
      id: sale.id,

      title: sale.name,

      productCount:
        products.length,

      products,
    };
  });
}

/* =====================================================
   🔥 PUBLIC SALE DETAILS
===================================================== */

export async function getPublicSaleDetailsService(
  id
) {
  const sale =
    await prisma.sale.findFirst({
      where: {
        id,

        isDeleted: false,

        enabled: true,
      },

      include: {
        saleProducts: {
          orderBy: {
            position: "asc",
          },

          include: {
            product: true,
          },
        },
      },
    });

  if (!sale) {
    throw new Error(
      "Sale not found"
    );
  }

  const products =
    sale.saleProducts.map(
      ({ product }) => {
        const images =
          parseImages(
            product.images
          );

        return {
          id: product.id,

          name:
            product.name,

          price:
            product.price !==
            null
              ? Number(
                  product.price
                )
              : null,

          originalPrice:
            product.originalPrice !==
            null
              ? Number(
                  product.originalPrice
                )
              : null,

          rating:
            product.rating !==
            null
              ? Number(
                  product.rating
                )
              : null,

          images,

          thumbnail:
            images[0] ||
            null,
        };
      }
    );

  return {
    sale: {
      id: sale.id,

      title: sale.name,
    },

    products,
  };
}

/* =====================================================
   🔥 ADMIN SALES
===================================================== */

export async function getAdminSalesService() {
  const sales =
    await prisma.sale.findMany({
      where: {
        isDeleted: false,
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {
        saleProducts: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

  return sales.map((sale) => ({
    ...sale,

    productIds:
      sale.saleProducts.map(
        (sp) =>
          sp.productId
      ),
  }));
}

/* =====================================================
   ➕ CREATE SALE
===================================================== */

export async function createSaleService({
  name,
  productIds = [],
}) {
  if (!name) {
    throw new Error(
      "Sale name required"
    );
  }

  /* =========================
     CREATE SALE
  ========================= */

  const sale =
    await prisma.sale.create({
      data: {
        name,
      },
    });

  /* =========================
     ADD PRODUCTS
  ========================= */

  if (
    Array.isArray(
      productIds
    ) &&
    productIds.length > 0
  ) {
    await prisma.saleProduct.createMany({
      data: productIds.map(
        (
          productId,
          index
        ) => ({
          saleId: sale.id,

          productId,

          position:
            index,
        })
      ),

      skipDuplicates: true,
    });
  }

  return {
    id: sale.id,

    name,

    productIds,
  };
}

/* =====================================================
   ✏️ UPDATE SALE
===================================================== */

export async function updateSaleService(
  id,
  {
    name,
    enabled,
  }
) {
  const existingSale =
    await prisma.sale.findUnique({
      where: {
        id,
      },
    });

  if (!existingSale) {
    throw new Error(
      "Sale not found"
    );
  }

  /* =========================
     UPDATE SALE
  ========================= */

  await prisma.sale.update({
    where: {
      id,
    },

    data: {
      name:
        name ??
        existingSale.name,

      enabled:
        enabled ??
        existingSale.enabled,
    },
  });

  return true;
}

/* =====================================================
   ❌ DELETE SALE
===================================================== */

export async function deleteSaleService(
  id
) {
  const existingSale =
    await prisma.sale.findUnique({
      where: {
        id,
      },
    });

  if (!existingSale) {
    throw new Error(
      "Sale not found"
    );
  }

  /* =========================
     SOFT DELETE
  ========================= */

  await prisma.sale.update({
    where: {
      id,
    },

    data: {
      isDeleted: true,
    },
  });

  return true;
}

/* =====================================================
   ➕ ADD PRODUCTS TO SALE
===================================================== */

export async function addProductsToSaleService(
  saleId,
  productIds
) {
  const sale =
    await prisma.sale.findUnique({
      where: {
        id: saleId,
      },
    });

  if (!sale) {
    throw new Error(
      "Sale not found"
    );
  }

  /* =========================
     GET CURRENT COUNT
  ========================= */

  const currentCount =
    await prisma.saleProduct.count({
      where: {
        saleId,
      },
    });

  /* =========================
     ADD PRODUCTS
  ========================= */

  await prisma.saleProduct.createMany({
    data: productIds.map(
      (
        productId,
        index
      ) => ({
        saleId,

        productId,

        position:
          currentCount +
          index,
      })
    ),

    skipDuplicates: true,
  });

  return true;
}

/* =====================================================
   ❌ REMOVE PRODUCT FROM SALE
===================================================== */

export async function removeProductFromSaleService(
  saleId,
  productId
) {
  await prisma.saleProduct.deleteMany({
    where: {
      saleId,

      productId,
    },
  });

  return true;
}

/* =====================================================
   🔥 ADMIN SALE DETAILS
===================================================== */

export async function getAdminSaleDetailsService(
  id
) {
  const sale =
    await prisma.sale.findUnique({
      where: {
        id,
      },

      include: {
        saleProducts: {
          orderBy: {
            position: "asc",
          },

          include: {
            product: true,
          },
        },
      },
    });

  if (!sale) {
    throw new Error(
      "Sale not found"
    );
  }

  const products =
    sale.saleProducts.map(
      (sp) => ({
        id:
          sp.product.id,

        name:
          sp.product.name,

        price:
          sp.product.price,

        position:
          sp.position,
      })
    );

  return {
    sale,

    products,
  };
}