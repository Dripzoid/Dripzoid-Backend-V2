import prisma from "../../lib/prisma.js";

/* =====================================================
   🔥 PARSE JSON / CSV FIELDS
===================================================== */

export function parseField(field) {
  if (!field) {
    return [];
  }

  /* =========================
     ARRAY ALREADY
  ========================= */

  if (Array.isArray(field)) {
    return field;
  }

  /* =========================
     JSON PARSE
  ========================= */

  try {
    const parsed =
      typeof field === "string"
        ? JSON.parse(field)
        : field;

    if (Array.isArray(parsed)) {
      return parsed;
    }

    return [parsed];
  } catch {}

  /* =========================
     CSV PARSE
  ========================= */

  return String(field)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/* =====================================================
   🔥 GET PRODUCT SIZES
===================================================== */

export async function getSizesForProduct(
  productId
) {
  const rows =
    await prisma.productSize.findMany({
      where: {
        productId,
      },

      orderBy: {
        size: "asc",
      },

      select: {
        size: true,

        stock: true,
      },
    });

  return (rows || []).map((row) => ({
    size: row.size,

    stock: Number(
      row.stock || 0
    ),
  }));
}

/* =====================================================
   🔥 BUILD SIZE STOCK MAP
===================================================== */

export function buildSizeStockMap(
  sizeRows = []
) {
  const map = {};

  sizeRows.forEach((sizeItem) => {
    if (!sizeItem?.size) {
      return;
    }

    map[
      String(sizeItem.size)
    ] = Number(
      sizeItem.stock || 0
    );
  });

  return map;
}

/* =====================================================
   🔥 CALCULATE TOTAL STOCK
===================================================== */

export function calculateTotalStock(
  sizeStockMap = {}
) {
  return Object.values(
    sizeStockMap
  ).reduce(
    (accumulator, value) =>
      accumulator +
      Number(value || 0),

    0
  );
}

/* =====================================================
   🔥 NORMALIZE IMAGES
===================================================== */

export function parseImages(
  images
) {
  return parseField(images);
}

/* =====================================================
   🔥 PRODUCT FORMATTER
===================================================== */

export async function formatProduct(
  product
) {
  /* =========================
     FETCH SIZE ROWS
  ========================= */

  const sizeRows =
    product.sizes
      ? product.sizes.map(
          (size) => ({
            size: size.size,

            stock: Number(
              size.stock || 0
            ),
          })
        )
      : await getSizesForProduct(
          product.id
        );

  /* =========================
     BUILD SIZE MAP
  ========================= */

  const sizeStock =
    buildSizeStockMap(
      sizeRows
    );

  /* =========================
     TOTAL STOCK
  ========================= */

  const totalStock =
    calculateTotalStock(
      sizeStock
    );

  /* =========================
     FORMAT RESPONSE
  ========================= */

  return {
    ...product,

    /* =========================
       BACKWARD COMPATIBILITY
    ========================= */

    category:
      product.category
        ?.category || null,

    categoryData:
      product.category || null,

    subcategory:
      product.category
        ?.subcategory ||
      product.subcategory ||
      null,

    categorySlug:
      product.category
        ?.slug || null,

    /* =========================
       NORMALIZED FIELDS
    ========================= */

    images:
      parseImages(
        product.images
      ),

    colors:
      parseField(
        product.colors
      ),

    sizes:
      Object.keys(
        sizeStock
      ),

    sizeRows,

    sizeStock,

    size_stock:
      JSON.stringify(
        sizeStock
      ),

    totalStock,

    stock:
      Number(
        product.stock || 0
      ) || totalStock,
  };
}