export const SHIPROCKET_STATUS_MAP = {
  // Order created in Shiprocket
  NEW: "Confirmed",

  // Pickup requested/generated
  PICKUP_GENERATED: "Packed",

  // Optional internal status
  AWB_ASSIGNED: "AWB Assigned",

  // Shipment lifecycle
  SHIPPED: "Shipped",

  IN_TRANSIT: "In Transit",

  OUT_FOR_DELIVERY: "Out For Delivery",

  DELIVERED: "Delivered",

  // RTO lifecycle
  RTO_INITIATED: "RTO Initiated",

  RTO_IN_TRANSIT: "RTO In Transit",

  RTO_DELIVERED: "RTO Delivered",

  // Cancellation
  CANCELED: "Cancelled",
  CANCELLED: "Cancelled",

  // NDR
  NDR: "NDR",

  // Return lifecycle (future)
  RETURN_REQUESTED: "Return Requested",

  RETURN_PICKED: "Return Picked",

  RETURN_DELIVERED: "Return Delivered",
};
