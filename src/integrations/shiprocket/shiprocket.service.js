import axios from "axios";

const BASE_URL =
  "https://apiv2.shiprocket.in/v1/external";

let cachedToken = null;

let tokenExpiry = null;

/* =====================================================
   🔐 GENERATE TOKEN
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

    /* =========================================
       CACHE TOKEN ~9 DAYS
    ========================================= */

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
      "❌ Shiprocket auth error:",
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
    Date.now() <
      tokenExpiry
  ) {
    return cachedToken;
  }

  return generateToken();
}

/* =====================================================
   🌐 SHIPROCKET REQUEST
===================================================== */

async function shiprocketRequest({
  method = "GET",
  endpoint,
  data = null,
  params = null,
  retry = true,
}) {
  const token =
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

    /* =========================================
       TOKEN EXPIRED
    ========================================= */

    if (
      status === 401 &&
      retry
    ) {
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
      `❌ Shiprocket API Error [${endpoint}]`,
      err?.response?.data ||
        err.message
    );

    throw err;
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
   📍 TRACK SHIPMENT
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
   ❌ CANCEL SHIPMENT
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

  length = 10,
  breadth = 10,
  height = 5,

  declared_value = 500,

  mode = "Surface",
}) {

  const response =
    await shiprocketRequest({
      endpoint:
        "/courier/serviceability/",

      params: {
        pickup_postcode,

        delivery_postcode,

        cod,

        weight,

        length,

        breadth,

        height,

        declared_value,

        mode,
      },
    });

  console.log(
    "📦 Shiprocket Serviceability Response:",
    JSON.stringify(
      response,
      null,
      2
    )
  );

  return response;
}

/* =====================================================
   🚚 CHECK SERVICEABILITY
===================================================== */

export async function checkServiceability(
  pincode,
  {
    weight = 0.5,
    cod = 0,

    length = 10,
    breadth = 10,
    height = 5,

    declared_value = 500,

    mode = "Surface",
  } = {}
) {

  const response =
    await getAvailableCouriers({
      pickup_postcode:
        process.env
          .SHIPROCKET_PICKUP_PINCODE,

      delivery_postcode:
        pincode,

      cod,
      weight,

      length,
      breadth,
      height,

      declared_value,

      mode,
    });

  /* =========================================
     CORRECT RESPONSE PATH
  ========================================= */

  return (
    response?.data
      ?.available_courier_companies ||
    []
  );
}

/* =====================================================
   📦 DELIVERY ESTIMATE
===================================================== */

export async function getDeliveryEstimateService(
  pincode,
  options = {}
) {

  const couriers =
    await checkServiceability(
      pincode,
      options
    );

  /* =========================================
     ❌ NO COURIERS
  ========================================= */

  if (
    !couriers ||
    couriers.length === 0
  ) {
    return {
      success: false,

      serviceable: false,

      couriers: [],
    };
  }

  /* =========================================
     ⚡ FASTEST COURIER
  ========================================= */

  const fastest =
    couriers.reduce(
      (best, current) => {

        if (!best) {
          return current;
        }

        const currentDays =
          Number(
            current.estimated_delivery_days
          ) || 999;

        const bestDays =
          Number(
            best.estimated_delivery_days
          ) || 999;

        return currentDays <
          bestDays
          ? current
          : best;
      },
      null
    );

  return {
    success: true,

    serviceable: true,

    estimated_delivery:
      fastest?.etd ||
      "ETA unavailable",

    cod_available:
      couriers.some(
        (courier) =>
          courier.cod === 1
      ),

    courier_count:
      couriers.length,

    fastest_courier:
      fastest?.courier_name,

    couriers:
      couriers.map(
        (courier) => ({
          courier_company_id:
            courier.courier_company_id,

          courier_name:
            courier.courier_name,

          etd:
            courier.etd,

          rate:
            courier.rate,

          cod:
            courier.cod,

          rating:
            courier.rating,

          estimated_delivery_days:
            courier.estimated_delivery_days,

          freight_charge:
            courier.freight_charge,

          rto_charges:
            courier.rto_charges,

          realtime_tracking:
            courier.realtime_tracking,

          delivery_performance:
            courier.delivery_performance,
        })
      ),
  };
}
