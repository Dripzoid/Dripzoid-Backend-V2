/* =====================================================
   📦 NORMALIZE SHIPPING ADDRESS
===================================================== */

export function normalizeShippingAddress(
  shippingAddress = {},
  user = {}
) {
  const pincode = String(
    shippingAddress?.pincode ||
    shippingAddress?.postalCode ||
    shippingAddress?.zipCode ||
    ""
  )
    .replace(/\D/g, "")
    .trim();

  return {
    ...shippingAddress,

    name:
      shippingAddress?.name ||
      `${shippingAddress?.first_name || ""}
       ${shippingAddress?.last_name || ""}`
        .replace(/\s+/g, " ")
        .trim(),

    line1:
      shippingAddress?.line1 ||
      shippingAddress?.address ||
      "N/A",

    line2:
      shippingAddress?.line2 ||
      "",

    city:
      String(
        shippingAddress?.city ||
        "N/A"
      )
        .replace(/\s+/g, " ")
        .trim(),

    state:
      String(
        shippingAddress?.state ||
        "N/A"
      )
        .replace(/\s+/g, " ")
        .trim(),

    country:
      String(
        shippingAddress?.country ||
        "India"
      )
        .replace(/\s+/g, " ")
        .trim(),

    pincode,

    phone:
      String(
        shippingAddress?.phone ||
        user?.phone ||
        ""
      )
        .replace(/\D/g, "")
        .trim(),

    email:
      String(
        shippingAddress?.email ||
        user?.email ||
        ""
      )
        .trim(),
  };
}

/* =====================================================
   🛒 NORMALIZE ORDER ITEMS
===================================================== */

export function normalizeOrderItems(
  items = []
) {
  return items.map((it, idx) => {

    const productId =
      it.product_id ??
      it.productId ??
      it.id ??
      (it.product &&
        (it.product.id ||
          it.product._id)) ??
      null;

    if (!productId) {
      throw new Error(
        `Item at index ${idx} missing product id`
      );
    }

    const unit_price =
      Number(
        it.unit_price ??
        it.unitPrice ??
        it.price ??
        it.selling_price ??
        0
      ) || 0;

    const quantity =
      Number(
        it.quantity ??
        it.qty ??
        it.units ??
        1
      ) || 1;

    const name =
      it.name ??
      it.product_name ??
      (it.product &&
        (it.product.name ||
          it.product.title)) ??

      `Product ${productId}`;

    const sku =
      it.sku ??
      it.SKU ??
      (it.product &&
        it.product.sku) ??

      `SKU-${productId}`;

    const selectedColor =
      it.selectedColor ??
      it.selected_color ??
      it.color ??
      null;

    const selectedSize =
      it.selectedSize ??
      it.selected_size ??
      it.size ??
      null;

    return {
      product_id:
        productId,

      unit_price,

      quantity,

      name,

      sku,

      selectedColor,

      selectedSize,

      raw: it,
    };
  });
}

/* =====================================================
   🚚 BUILD SHIPROCKET PAYLOAD
===================================================== */

export function buildShiprocketPayload({
  orderId,
  orderNumber,
  items,
  shippingAddress,
  paymentMethod,
  totalAmount,
}) {
  const fullName =
    shippingAddress?.name?.trim() ||
    "Customer";

  const nameParts =
    fullName.split(/\s+/);

  const firstName =
    nameParts[0] ||
    "Customer";

  const lastName =
    nameParts.length > 1
      ? nameParts
          .slice(1)
          .join(" ")
      : "";

  const isCOD =
    String(
      paymentMethod || ""
    ).toUpperCase() === "COD";

  /* =========================================
     COD CHARGE
  ========================================= */

  const codCharge =
    isCOD ? 25 : 0;

  /* =========================================
     PRODUCT TOTAL
  ========================================= */

  const productTotal =
    Math.max(
      0,
      Number(totalAmount || 0) -
        codCharge
    );

  return {
    order_id:
      orderNumber,

    order_date:
      new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " "),

    pickup_location:
      process.env
        .SHIPROCKET_PICKUP ||
      "warehouse",

    channel_id:
      Number(
        process.env
          .SHIPROCKET_CHANNEL_ID || 1
      ),

    /* =====================================
       BILLING DETAILS
    ===================================== */

    billing_customer_name:
      firstName,

    billing_last_name:
      lastName,

    billing_address:
      shippingAddress?.line1 ||
      "N/A",

    billing_address_2:
      shippingAddress?.line2 ||
      "",

    billing_city:
      shippingAddress?.city ||
      "N/A",

    billing_pincode:
      shippingAddress?.pincode ||
      "000000",

    billing_state:
      shippingAddress?.state ||
      "N/A",

    billing_country:
      shippingAddress?.country ||
      "India",

    billing_email:
      shippingAddress?.email ||
      "",

    billing_phone:
      shippingAddress?.phone ||
      "0000000000",

    /* =====================================
       SHIPPING DETAILS
    ===================================== */

    shipping_is_billing:
      true,

    /* =====================================
       ORDER ITEMS
    ===================================== */

    order_items:
      items.map((ni) => ({
        name:
          ni.name,

        sku:
          ni.sku,

        units:
          Number(
            ni.quantity
          ),

        selling_price:
          Number(
            ni.unit_price
          ),
      })),

    /* =====================================
       PAYMENT
    ===================================== */

    payment_method:
      isCOD
        ? "COD"
        : "Prepaid",

    /* =====================================
       PRICING
    ===================================== */

    sub_total:
      productTotal,

    transaction_charges:
      codCharge,

    shipping_charges: 0,

    total_discount: 0,

    /* =====================================
       PACKAGE DIMENSIONS
    ===================================== */

    length: 15,
    breadth: 10,
    height: 5,
    weight: 0.5,
  };
}
