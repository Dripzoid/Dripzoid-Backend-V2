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
    limit = "all",
    search,
    slug,
    sort,
  } = query;

  /* =========================
     BASE FILTER
  ========================= */

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
      is: {
        category:
          String(category)
            .trim()
            .toLowerCase(),
      },
    };
  }

  /* =========================
     SUBCATEGORY FILTER
  ========================= */

  if (subcategory) {
    const subcategories =
      String(subcategory)
        .split(",")
        .map((s) =>
          s.trim().toLowerCase()
        );

    where.category = {
      is: {
        ...(where.category?.is ||
          {}),

        subcategory: {
          in: subcategories,
        },
      },
    };
  }

  /* =========================
     CATEGORY SLUG FILTER
  ========================= */

  if (slug) {
    where.category = {
      is: {
        ...(where.category?.is ||
          {}),

        slug: {
          equals:
            String(slug)
              .trim()
              .toLowerCase(),

          mode:
            "insensitive",
        },
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

      {
        subcategory: {
          contains:
            String(search),

          mode:
            "insensitive",
        },
      },

      {
        category: {
          is: {
            subcategory: {
              contains:
                String(search),

              mode:
                "insensitive",
            },
          },
        },
      },
    ];
  }

  /* =========================
     SORTING
  ========================= */

  let orderBy = {
    createdAt: "desc",
  };

  if (
    sort === "price_asc"
  ) {
    orderBy = {
      price: "asc",
    };
  }

  else if (
    sort === "price_desc"
  ) {
    orderBy = {
      price: "desc",
    };
  }

  else if (
    sort === "newest"
  ) {
    orderBy = {
      createdAt:
        "desc",
    };
  }

  /* =========================
     FETCH PRODUCTS
  ========================= */

  const products =
    await prisma.product.findMany({
      where,

      orderBy,

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

  /* =========================
     FORMAT RESPONSE
  ========================= */

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

/* =====================================================
   🔥 GET CATEGORIES
===================================================== */

export async function getCategoriesService(
  query = {}
) {
  const {
    category,
  } = query;

  const where = {};

  if (category) {
    where.category =
      String(category)
        .trim()
        .toLowerCase();
  }

  const categories =
    await prisma.category.findMany({
      where,

      orderBy: {
        subcategory:
          "asc",
      },
    });

  /* =========================
     GROUPED RESPONSE
  ========================= */

  const grouped = {};

  categories.forEach((cat) => {
    if (
      !grouped[
        cat.category
      ]
    ) {
      grouped[
        cat.category
      ] = [];
    }

    grouped[
      cat.category
    ].push({
      id: cat.id,

      name:
        cat.subcategory,

      subcategory:
        cat.subcategory,

      slug: cat.slug,
    });
  });

  return Object.entries(
    grouped
  ).map(
    ([name, subcategories]) => ({
      category:
        name,

      subcategories,
    })
  );
}

/* =====================================================
   🔥 RELATED PRODUCTS
===================================================== */

export async function getRelatedProductsService(
  id
) {
  /* =========================
     CURRENT PRODUCT
  ========================= */

  const current =
    await prisma.product.findUnique({
      where: {
        id,
      },

      include: {
        category: true,
      },
    });

  if (!current) {
    return [];
  }

  /* =========================
     FETCH RELATED
  ========================= */

  const products =
    await prisma.product.findMany({
      where: {
        id: {
          not: id,
        },

        OR: [
          /* =====================
             SAME SUBCATEGORY
          ===================== */

          {
            subcategory:
              current.subcategory,
          },

          /* =====================
             SAME CATEGORY
          ===================== */

          {
            categoryId:
              current.categoryId,
          },

          /* =====================
             SIMILAR NAME
          ===================== */

          {
            name: {
              contains:
                current.name
                  .split(" ")[0],

              mode:
                "insensitive",
            },
          },
        ],
      },

      include: {
        sizes: {
          orderBy: {
            size: "asc",
          },
        },

        category: true,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take: 12,
    });

  return Promise.all(
    products.map(
      formatProduct
    )
  );
}
