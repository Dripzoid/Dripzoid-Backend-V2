import {
  getPublicSalesService,
  getPublicSaleDetailsService,
  getAdminSalesService,
  createSaleService,
  updateSaleService,
  deleteSaleService,
  addProductsToSaleService,
  removeProductFromSaleService,
  getAdminSaleDetailsService,
} from "./sales.service.js";

// 🌍 PUBLIC SALES
export const getPublicSales = async (
  req,
  res
) => {
  try {
    const limit = Math.max(
      1,
      Math.min(
        50,
        parseInt(
          req.query.limit || "10",
          10
        )
      )
    );

    const productsPerSale =
      Math.max(
        1,
        Math.min(
          50,
          parseInt(
            req.query.productsPerSale ||
              "12",
            10
          )
        )
      );

    const data =
      await getPublicSalesService({
        limit,
        productsPerSale,
      });

    res.json(data);
  } catch (err) {
    console.error(
      "getPublicSales error:",
      err
    );

    res.status(500).json({
      message:
        err.message ||
        "Failed to fetch public sales",
    });
  }
};

// 🌍 PUBLIC SALE DETAILS
export const getPublicSaleDetails =
  async (req, res) => {
    try {
      const data =
        await getPublicSaleDetailsService(
          req.params.id
        );

      res.json(data);
    } catch (err) {
      console.error(
        "getPublicSaleDetails error:",
        err
      );

      res.status(404).json({
        message:
          err.message ||
          "Sale not found",
      });
    }
  };

// 🔐 ADMIN SALES
export const getAdminSales =
  async (req, res) => {
    try {
      const data =
        await getAdminSalesService();

      res.json(data);
    } catch (err) {
      console.error(
        "getAdminSales error:",
        err
      );

      res.status(500).json({
        message:
          err.message ||
          "Failed to fetch sales",
      });
    }
  };

// ➕ CREATE SALE
export const createSale = async (
  req,
  res
) => {
  try {
    const incoming =
      Array.isArray(
        req.body.productIds
      )
        ? req.body.productIds
        : Array.isArray(
            req.body.product_ids
          )
        ? req.body.product_ids
        : [];

    const productIds = incoming.map(
      (pid) =>
        typeof pid === "string" &&
        /^\d+$/.test(pid)
          ? Number(pid)
          : pid
    );

    const data =
      await createSaleService({
        name: req.body.name,
        productIds,
      });

    res.status(201).json({
      message: "Sale created",
      sale: data,
    });
  } catch (err) {
    console.error(
      "createSale error:",
      err
    );

    res.status(400).json({
      message:
        err.message ||
        "Failed to create sale",
    });
  }
};

// ✏️ UPDATE SALE
export const updateSale = async (
  req,
  res
) => {
  try {
    await updateSaleService(
      req.params.id,
      req.body
    );

    res.json({
      message:
        "Sale updated",
    });
  } catch (err) {
    console.error(
      "updateSale error:",
      err
    );

    res.status(400).json({
      message:
        err.message ||
        "Failed to update sale",
    });
  }
};

// ❌ DELETE SALE
export const deleteSale = async (
  req,
  res
) => {
  try {
    await deleteSaleService(
      req.params.id
    );

    res.json({
      message:
        "Sale soft-deleted",
    });
  } catch (err) {
    console.error(
      "deleteSale error:",
      err
    );

    res.status(500).json({
      message:
        err.message ||
        "Failed to delete sale",
    });
  }
};

// ➕ ADD PRODUCTS
export const addProductsToSale =
  async (req, res) => {
    try {
      const incoming =
        Array.isArray(
          req.body.productIds
        )
          ? req.body.productIds
          : Array.isArray(
              req.body.product_ids
            )
          ? req.body.product_ids
          : [];

      if (!incoming.length) {
        return res.status(400).json({
          message:
            "No products provided",
        });
      }

      const productIds =
        incoming.map((pid) =>
          typeof pid === "string" &&
          /^\d+$/.test(pid)
            ? Number(pid)
            : pid
        );

      await addProductsToSaleService(
        req.params.sale_id,
        productIds
      );

      res.json({
        message:
          "Products added",
        productIds,
      });
    } catch (err) {
      console.error(
        "addProductsToSale error:",
        err
      );

      res.status(500).json({
        message:
          err.message ||
          "Failed to add products",
      });
    }
  };

// ❌ REMOVE PRODUCT
export const removeProductFromSale =
  async (req, res) => {
    try {
      await removeProductFromSaleService(
        req.params.sale_id,
        req.params.product_id
      );

      res.json({
        message:
          "Product removed from sale",
      });
    } catch (err) {
      console.error(
        "removeProductFromSale error:",
        err
      );

      res.status(500).json({
        message:
          err.message ||
          "Failed to remove product",
      });
    }
  };

// 🔐 ADMIN SALE DETAILS
export const getAdminSaleDetails =
  async (req, res) => {
    try {
      const data =
        await getAdminSaleDetailsService(
          req.params.id
        );

      res.json(data);
    } catch (err) {
      console.error(
        "getAdminSaleDetails error:",
        err
      );

      res.status(404).json({
        message:
          err.message ||
          "Sale not found",
      });
    }
  };