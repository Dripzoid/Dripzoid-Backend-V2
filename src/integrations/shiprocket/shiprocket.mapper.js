// shiprocket.mapper.js

export function mapOrderToShiprocket(
  order
) {
  return {
    order_id: order.orderId,

    order_date:
      new Date().toISOString(),

    pickup_location: "primary",

    billing_customer_name:
      order.shippingAddress.fullName,

    billing_phone:
      order.shippingAddress.phone,

    billing_address:
      order.shippingAddress.address,

    billing_city:
      order.shippingAddress.city,

    billing_pincode:
      order.shippingAddress.pincode,

    billing_state:
      order.shippingAddress.state,

    billing_country: "India",

    shipping_is_billing: true,

    order_items:
      order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.quantity,
        selling_price:
          item.price,
      })),

    payment_method:
      order.paymentMethod === "COD"
        ? "COD"
        : "Prepaid",

    sub_total:
      order.pricing.total,

    length: 10,
    breadth: 10,
    height: 5,
    weight: 0.5,
  };
}