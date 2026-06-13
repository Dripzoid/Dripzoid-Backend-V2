export const SHIPROCKET_STATUS_MAP = {
  // Order created in Shiprocket
  NEW: "Confirmed",

  // Pickup requested/generated
  PICKUP_GENERATED: "Pickup Scheduled",

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

export const SHIPMENT_TO_ORDER_STATUS = {
  "Confirmed": "Confirmed",

  "AWB Assigned": "Packed",

  "Shipped": "Shipped",

  "In Transit": "Shipped",

  "Out For Delivery": "Out For Delivery",

  "Delivered": "Delivered",

  "Cancelled": "Cancelled",

  // RTO → Cancelled
  "RTO Initiated": "Cancelled",
  "RTO In Transit": "Cancelled",
  "RTO Delivered": "Cancelled",

  // Customer Returns → Returned
  "Return Requested": "Returned",
  "Return Picked": "Returned",
  "Return Delivered": "Returned",
};
