import {
  getAdminProductsService,
  getAdminProductByIdService,
  createProductService,
  updateProductService,
  deleteProductService,
} from "./adminProducts.service.js";

// 📦 GET ALL PRODUCTS
export const getProducts = async (req, res) => {
  try {
    const data =
      await getAdminProductsService(req.query);

    res.json(data);
  } catch (err) {
    console.error(
      "getProducts controller error:",
      err
    );

    res.status(500).json({
      message:
        err.message ||
        "Failed to fetch products",
    });
  }
};

// 📦 GET SINGLE PRODUCT
export const getProduct = async (req, res) => {
  try {
    const data =
      await getAdminProductByIdService(
        req.params.id
      );

    res.json(data);
  } catch (err) {
    console.error(
      "getProduct controller error:",
      err
    );

    res.status(404).json({
      message:
        err.message ||
        "Product not found",
    });
  }
};

// ➕ CREATE PRODUCT
export const createProduct = async (
  req,
  res
) => {
  try {
    const data =
      await createProductService(req.body);

    res.status(201).json({
      message:
        "Product created successfully",
      product: data,
    });
  } catch (err) {
    console.error(
      "createProduct controller error:",
      err
    );

    res.status(400).json({
      message:
        err.message ||
        "Failed to create product",
    });
  }
};

// ✏️ UPDATE PRODUCT
export const updateProduct = async (
  req,
  res
) => {
  try {
    const data =
      await updateProductService(
        req.params.id,
        req.body
      );

    res.json({
      message:
        "Product updated successfully",
      product: data,
    });
  } catch (err) {
    console.error(
      "updateProduct controller error:",
      err
    );

    res.status(400).json({
      message:
        err.message ||
        "Failed to update product",
    });
  }
};

// ❌ DELETE PRODUCT
export const deleteProduct = async (
  req,
  res
) => {
  try {
    await deleteProductService(
      req.params.id
    );

    res.json({
      message:
        "Product deleted successfully",
    });
  } catch (err) {
    console.error(
      "deleteProduct controller error:",
      err
    );

    res.status(500).json({
      message:
        err.message ||
        "Failed to delete product",
    });
  }
};