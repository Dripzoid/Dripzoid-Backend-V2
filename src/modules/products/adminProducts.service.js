// modules/admin/products/adminProducts.service.js

import prisma from "../../lib/prisma.js";

import {
  formatProduct,
  calculateTotalStock,
} from "./product.utils.js";

/* =====================================================
   🔥 PARSE SIZE STOCK
===================================================== */

function parseSizeStock(input) {
  if (!input) {
    return {};
  }

  if (
    typeof input === "object"
  ) {
    return input;
  }

  try {
    const parsed =
      JSON.parse(input);

    if (
      typeof parsed ===
        "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }
  } catch {}

  const map = {};

  String(input)
    .split(",")
    .map((p) => p.trim())
    .forEach((pair) => {
      if (!pair) {
        return;
      }

      const [size, qty] =
        pair
          .split(":")
          .map((s) =>
            s?.trim()
          );

      if (size) {
        map[size] =
          Number(qty) || 0;
      }
    });

  return map;
}



/* =====================================================
   🔥 GET CATEGORY
===================================================== */

async function getCategoryByName(
  categoryName
) {
  if (!categoryName) {
    return null;
  }

  const normalizedCategory =
    String(categoryName)
      .trim()
      .toLowerCase();

  const category =
    await prisma.category.findFirst(
      {
        where: {
          category:
            normalizedCategory,
        },
      }
    );

  if (!category) {
    throw new Error(
      `Category not found: ${categoryName}`
    );
  }

  return category;
}

/* =====================================================
   📦 GET ALL PRODUCTS
===================================================== */

export async function getAdminProductsService(
  {
    search = "",
    page = 1,
    limit = 20,
    sort = "newest",
  }
) {
  const currentPage =
    Number(page) || 1;

  const pageLimit =
    Number(limit) || 20;

  const skip =
    (currentPage - 1) *
    pageLimit;

  /* =========================
     SORT MAPPING
  ========================= */

  const ORDER_MAP = {
    newest: {
      updatedAt:
        "desc",
    },

    price_asc: {
      price: "asc",
    },

    price_desc: {
      price: "desc",
    },

    best_selling: {
      sold: "desc",
    },

    low_stock: {
      stock: "asc",
    },
  };

  const orderBy =
    ORDER_MAP[
      sort
    ] ||
    ORDER_MAP.newest;

  /* =========================
     SEARCH FILTER
  ========================= */

  const where = search
    ? {
        OR: [
          {
            name: {
              contains:
                search,
              mode:
                "insensitive",
            },
          },

          {
            description: {
              contains:
                search,
              mode:
                "insensitive",
            },
          },
        ],
      }
    : {};

  /* =========================
     FETCH PRODUCTS
  ========================= */

  const [
    total,
    products,
  ] = await prisma.$transaction([
    prisma.product.count({
      where,
    }),

    prisma.product.findMany({
      where,

      skip,

      take:
        pageLimit,

      orderBy,

      include: {
        category:
          true,
      },
    }),
  ]);

  /* =========================
     FETCH PRODUCT SIZES
  ========================= */

  const productIds =
    products.map(
      (p) => p.id
    );

  const productSizes =
    await prisma.productSize.findMany(
      {
        where: {
          productId: {
            in: productIds,
          },
        },
      }
    );

  /* =========================
     ATTACH SIZES
  ========================= */

  const productsWithSizes =
    products.map(
      (product) => ({
        ...product,

        category:
          product.category
            ?.name || "",

        productSizes:
          productSizes.filter(
            (size) =>
              size.productId ===
              product.id
          ),
      })
    );

  /* =========================
     FORMAT PRODUCTS
  ========================= */

  const data =
    await Promise.all(
      productsWithSizes.map(
        formatProduct
      )
    );

  return {
    data,

    meta: {
      total,

      page:
        currentPage,

      pages:
        Math.ceil(
          total /
            pageLimit
        ),

      limit:
        pageLimit,
    },
  };
}

/* =====================================================
   📦 GET SINGLE PRODUCT
===================================================== */

export async function getAdminProductByIdService(
  id
) {
  const product =
    await prisma.product.findUnique({
      where: {
        id,
      },

      include: {
        category:
          true,
      },
    });

  if (!product) {
    throw new Error(
      "Product not found"
    );
  }

  const productSizes =
    await prisma.productSize.findMany(
      {
        where: {
          productId: id,
        },
      }
    );

  return formatProduct({
    ...product,

    category:
      product.category
        ?.name || "",

    productSizes,
  });
}

/* =====================================================
   ➕ CREATE PRODUCT
===================================================== */

export async function createProductService(
  body
) {
  const {
    name,
    category,
    price,
    actualPrice,
    images,
    rating,
    sizes,
    colors,
    color,
    originalPrice,
    description,
    subcategory,
    stock,
    featured,
    size_stock,
  } = body;

  /* =========================
     VALIDATION
  ========================= */

  if (
    !name ||
    !category ||
    price == null
  ) {
    throw new Error(
      "Name, category and price required"
    );
  }

  /* =========================
     CATEGORY
  ========================= */

  const categoryRecord =
    await getCategoryByName(
      category
    );

  /* =========================
     SIZE STOCK
  ========================= */

  const parsedSizeStock =
    parseSizeStock(
      size_stock
    );

  const totalStock =
    calculateTotalStock(
      parsedSizeStock
    ) ||
    Number(stock) ||
    0;

  /* =========================
     CREATE PRODUCT
  ========================= */

  const product =
    await prisma.product.create({
      data: {
        name:
          name?.trim(),

        category: {
          connect: {
            id:
              categoryRecord.id,
          },
        },

        price:
          Number(price) ||
          0,

        actualPrice:
          Number(
            actualPrice
          ) || 0,

        images:
          images || "",

        rating:
          Number(
            rating
          ) || 0,

        sizes:
          sizes || "",

        colors:
          (
            colors ||
            color ||
            ""
          ).toString(),

        originalPrice:
          Number(
            originalPrice
          ) || 0,

        description:
          description ||
          "",

        subcategory:
          subcategory ||
          "",

        stock:
          totalStock,

        featured:
          Boolean(
            Number(
              featured
            )
          ),
      },
    });

  /* =========================
     CREATE PRODUCT SIZES
  ========================= */

  const sizeEntries =
    Object.entries(
      parsedSizeStock
    );

  if (
    sizeEntries.length >
    0
  ) {
    await prisma.productSize.createMany(
      {
        data:
          sizeEntries.map(
            ([
              size,
              qty,
            ]) => ({
              productId:
                product.id,

              size,

              stock:
                Number(
                  qty
                ) || 0,
            })
          ),
      }
    );
  }

  return getAdminProductByIdService(
    product.id
  );
}

/* =====================================================
   ✏️ UPDATE PRODUCT
===================================================== */

export async function updateProductService(
  id,
  body
) {
  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingProduct =
    await prisma.product.findUnique({
      where: {
        id,
      },
    });

  if (!existingProduct) {
    throw new Error(
      "Product not found"
    );
  }

  /* =========================
     CATEGORY
  ========================= */

  const categoryRecord =
    await getCategoryByName(
      body.category
    );

  /* =========================
     PARSE SIZE STOCK
  ========================= */

  const parsedSizeStock =
    parseSizeStock(
      body.size_stock
    );

  const totalStock =
    calculateTotalStock(
      parsedSizeStock
    ) ||
    Number(
      body.stock
    ) ||
    0;

  /* =========================
     UPDATE PRODUCT
  ========================= */

  await prisma.product.update({
    where: {
      id,
    },

    data: {
      name:
        body.name?.trim(),

      category: {
        connect: {
          id:
            categoryRecord.id,
        },
      },

      price:
        Number(
          body.price
        ) || 0,

      actualPrice:
        Number(
          body.actualPrice
        ) || 0,

      images:
        body.images ||
        "",

      rating:
        Number(
          body.rating
        ) || 0,

      sizes:
        body.sizes ||
        "",

      colors:
        (
          body.colors ||
          body.color ||
          ""
        ).toString(),

      originalPrice:
        Number(
          body.originalPrice
        ) || 0,

      description:
        body.description ||
        "",

      subcategory:
        body.subcategory ||
        "",

      stock:
        totalStock,

      featured:
        Boolean(
          Number(
            body.featured
          )
        ),
    },
  });

  /* =========================
     REPLACE PRODUCT SIZES
  ========================= */

  await prisma.productSize.deleteMany({
    where: {
      productId: id,
    },
  });

  const sizeEntries =
    Object.entries(
      parsedSizeStock
    );

  if (
    sizeEntries.length >
    0
  ) {
    await prisma.productSize.createMany(
      {
        data:
          sizeEntries.map(
            ([
              size,
              qty,
            ]) => ({
              productId:
                id,

              size,

              stock:
                Number(
                  qty
                ) || 0,
            })
          ),
      }
    );
  }

  return getAdminProductByIdService(
    id
  );
}

/* =====================================================
   ❌ DELETE PRODUCT
===================================================== */

export async function deleteProductService(
  id
) {
  const existingProduct =
    await prisma.product.findUnique({
      where: {
        id,
      },
    });

  if (!existingProduct) {
    throw new Error(
      "Product not found"
    );
  }

  await prisma.$transaction([
    prisma.productSize.deleteMany(
      {
        where: {
          productId:
            id,
        },
      }
    ),

    prisma.product.delete({
      where: {
        id,
      },
    }),
  ]);

  return true;
}
