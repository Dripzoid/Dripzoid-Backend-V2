import axios from "axios";

const BASE_URL =
  "https://apiv2.shiprocket.in/v1/external";

let cachedToken = null;
let tokenExpiry = null;

/* =====================================================
   🔐 AUTH TOKEN
===================================================== */

async function generateToken() {
  try {
    const response =
      await axios.post(
        `${BASE_URL}/auth/login`,
        {
          email:
            process.env
              .SHIPROCKET_EMAIL,

          password:
            process.env
              .SHIPROCKET_PASSWORD,
        }
      );

    cachedToken =
      response.data.token;

    // cache for ~9 days
    tokenExpiry =
      Date.now() +
      9 *
        24 *
        60 *
        60 *
        1000;

    console.log(
      "✅ Shiprocket token refreshed"
    );

    return cachedToken;
  } catch (err) {
    console.error(
      "Shiprocket auth error:",
      err?.response?.data ||
        err.message
    );

    throw err;
  }
}

/* =====================================================
   🔑 GET VALID TOKEN
===================================================== */

export async function getShiprocketToken() {
  if (
    cachedToken &&
    tokenExpiry &&
    Date.now() < tokenExpiry
  ) {
    return cachedToken;
  }

  return generateToken();
}

/* =====================================================
   🌐 API CLIENT
===================================================== */

async function shiprocketRequest({
  method = "GET",
  endpoint,
  data = null,
  params = null,
  retry = true,
}) {
  let token =
    await getShiprocketToken();

  try {
    const response =
      await axios({
        method,

        url:
          `${BASE_URL}${endpoint}`,

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        data,
        params,

        timeout: 15000,
      });

    return response.data;
  } catch (err) {
    const status =
      err?.response?.status;

    // Token expired
    if (status === 401 && retry) {
      console.log(
        "🔄 Refreshing Shiprocket token..."
      );

      cachedToken = null;
      tokenExpiry = null;

      return shiprocketRequest({
        method,
        endpoint,
        data,
        params,
        retry: false,
      });
    }

    console.error(
      `Shiprocket API Error [${endpoint}]`,
      err?.response?.data ||
        err.message
    );

    throw new IntegrationError(
      `Shiprocket API failed: ${endpoint}`,

      err?.response?.data ||
        err.message
    );
  }
}

/* =====================================================
   📦 CREATE ORDER
===================================================== */

export async function createShiprocketOrder(
  payload
) {
  return shiprocketRequest({
    method: "POST",

    endpoint:
      "/orders/create/adhoc",

    data: payload,
  });
}

/* =====================================================
   🚚 GENERATE AWB
===================================================== */

export async function generateAWB({
  shipment_id,
  courier_id,
}) {
  return shiprocketRequest({
    method: "POST",

    endpoint:
      "/courier/assign/awb",

    data: {
      shipment_id,
      courier_id,
    },
  });
}

/* =====================================================
   📍 TRACK ORDER
===================================================== */

export async function trackShipment(
  awb
) {
  return shiprocketRequest({
    endpoint:
      `/courier/track/awb/${awb}`,
  });
}

/* =====================================================
   🚛 REQUEST PICKUP
===================================================== */

export async function requestPickup(
  shipment_id
) {
  return shiprocketRequest({
    method: "POST",

    endpoint:
      "/courier/generate/pickup",

    data: {
      shipment_id: [
        shipment_id,
      ],
    },
  });
}

/* =====================================================
   ❌ CANCEL ORDER
===================================================== */

export async function cancelShipment(
  order_id
) {
  return shiprocketRequest({
    method: "POST",

    endpoint:
      "/orders/cancel",

    data: {
      ids: [order_id],
    },
  });
}

/* =====================================================
   📦 AVAILABLE COURIERS
===================================================== */

export async function getAvailableCouriers({
  pickup_postcode,
  delivery_postcode,
  cod = 0,
  weight = 0.5,
}) {
  return shiprocketRequest({
    endpoint:
      "/courier/serviceability",

    params: {
      pickup_postcode,
      delivery_postcode,
      cod,
      weight,
    },
  });
}

export async function checkServiceability(
  pincode,
  {
    weight = 0.5,
    cod = 0,
  } = {}
) {

  const response =
    await getAvailableCouriers({
      pickup_postcode:
        process.env
          .SHIPROCKET_PICKUP_PINCODE,

      delivery_postcode:
        pincode,

      weight,
      cod,
    });

  return (
    response?.data
      ?.available_courier_companies ||
    []
  );
}

