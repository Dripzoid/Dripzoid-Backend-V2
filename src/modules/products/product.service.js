import prisma from "../../lib/prisma.js";

import {
  formatProduct,
} from "./product.utils.js";

/* =====================================================
   🔥 GET PRODUCTS
===================================================== */

export async function getProductsService(
  query = {}
) {
  const {
    category,
    subcategory,
    minPrice = 0,
    maxPrice = 999999,
    limit = 20,
    search,
  } = query;

  const where = {
    price: {
      gte: Number(
        minPrice
      ),

      lte: Number(
        maxPrice
      ),
    },
  };

  /* =========================
     CATEGORY FILTER
  ========================= */

  if (category) {
    where.category = {
      category:
        String(category)
          .charAt(0)
          .toUpperCase() +
        String(category)
          .slice(1)
          .toLowerCase(),
    };
  }

  /* =========================
     SUBCATEGORY FILTER
  ========================= */

  if (subcategory) {
    where.category = {
      ...(where.category ||
        {}),

      subcategory: {
        equals:
          String(
            subcategory
          ),

        mode:
          "insensitive",
      },
    };
  }

  /* =========================
     SEARCH FILTER
  ========================= */

  if (search) {
    where.OR = [
      {
        name: {
          contains:
            String(search),

          mode:
            "insensitive",
        },
      },

      {
        description: {
          contains:
            String(search),

          mode:
            "insensitive",
        },
      },
    ];
  }

  /* =========================
     FETCH PRODUCTS
  ========================= */

  const products =
    await prisma.product.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      include: {
        sizes: {
          orderBy: {
            size: "asc",
          },
        },

        category: true,
      },

      ...(limit !== "all"
        ? {
            take:
              Number(limit),
          }
        : {}),
    });

  return Promise.all(
    products.map(
      formatProduct
    )
  );
}

/* =====================================================
   🔥 GET PRODUCT BY ID
===================================================== */

export async function getProductByIdService(
  id
) {
  const product =
    await prisma.product.findUnique({
      where: {
        id,
      },

      include: {
        sizes: {
          orderBy: {
            size: "asc",
          },
        },

        category: true,
      },
    });

  if (!product) {
    return null;
  }

  return formatProduct(
    product
  );
}

/* =====================================================
   🔥 FEATURED PRODUCTS
===================================================== */

export async function getFeaturedProductsService() {
  const products =
    await prisma.product.findMany({
      where: {
        featured: true,
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {
        sizes: {
          orderBy: {
            size: "asc",
          },
        },

        category: true,
      },
    });

  return Promise.all(
    products.map(
      formatProduct
    )
  );
}

/* =====================================================
   🔥 TRENDING PRODUCTS
===================================================== */

export async function getTrendingProductsService() {
  const products =
    await prisma.product.findMany({
      orderBy: {
        sold: "desc",
      },

      take: 10,

      include: {
        sizes: {
          orderBy: {
            size: "asc",
          },
        },

        category: true,
      },
    });

  return Promise.all(
    products.map(
      formatProduct
    )
  );
}