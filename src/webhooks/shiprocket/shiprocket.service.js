import Order from "../../modules/order/order.model.js";

export async function processShiprocketWebhook(
  payload
) {
  console.log(
    "Shiprocket Webhook:",
    payload
  );

  const {
    order_id,
    shipment_status,
    awb_code,
  } = payload;

  const order = await Order.findOne({
    shiprocketOrderId: order_id,
  });

  if (!order) {
    throw new Error(
      "Order not found"
    );
  }

  switch (shipment_status) {
    case "NEW":
      order.status = "PLACED";
      break;

    case "PICKED_UP":
      order.status = "PACKED";
      break;

    case "SHIPPED":
      order.status = "SHIPPED";
      break;

    case "OUT FOR DELIVERY":
      order.status =
        "OUT_FOR_DELIVERY";
      break;

    case "DELIVERED":
      order.status =
        "DELIVERED";
      break;

    case "CANCELLED":
      order.status =
        "CANCELLED";
      break;

    default:
      console.log(
        "Unhandled Shiprocket Status:",
        shipment_status
      );
  }

  order.awb = awb_code;

  await order.save();

  return {
    orderId: order._id,
    status: order.status,
  };
}
