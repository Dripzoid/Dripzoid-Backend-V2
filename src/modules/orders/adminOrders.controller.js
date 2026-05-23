import {
  getAllOrdersService,
  getAdminOrderByIdService,
  updateOrderStatusService,
  deleteOrderService,
} from "./adminOrders.service.js";


// 📦 GET ALL ORDERS
export const getAllOrders = async (req, res) => {
  try {
    const data = await getAllOrdersService(req.query);

    res.json(data);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// 📦 GET SINGLE ORDER
export const getOrder = async (req, res) => {
  try {
    const data = await getAdminOrderByIdService(
      req.params.id
    );

    res.json(data);
  } catch (err) {
    res.status(404).json({
      message: err.message,
    });
  }
};

// 🔄 UPDATE STATUS
export const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    await updateOrderStatusService(
      req.params.id,
      status
    );

    res.json({
      message: "Order status updated successfully",
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
};

// ❌ DELETE ORDER
export const deleteOrder = async (req, res) => {
  try {
    await deleteOrderService(req.params.id);

    res.json({
      message: "Order deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};