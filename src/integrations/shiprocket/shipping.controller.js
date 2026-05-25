import {
  checkServiceability,
  getDeliveryEstimateService,
} from "./shiprocket.service.js";

/* =====================================================
   📦 DELIVERY ESTIMATE
===================================================== */

export async function getDeliveryEstimate(
  req,
  res,
  next
) {
  try {
    const { pincode } =
      req.params;

    const weight =
      Number(
        req.query.weight
      ) || 0.5;

    const cod =
      req.query.cod === "true"
        ? 1
        : 0;

    /* =========================================
       📦 GET ESTIMATE
    ========================================= */

    const result =
      await getDeliveryEstimateService(
        pincode,
        {
          weight,
          cod,
        }
      );

    /* =========================================
       ❌ NOT SERVICEABLE
    ========================================= */

    if (
      !result?.serviceable
    ) {
      return res.status(404).json({
        success: false,

        serviceable: false,

        message:
          "Delivery unavailable",
      });
    }

    /* =========================================
       ✅ RESPONSE
    ========================================= */

    return res.json({
      success: true,

      serviceable: true,

      estimated_delivery:
        result.estimated_delivery,

      cod_available:
        result.cod_available,

      courier_count:
        result.courier_count,

      couriers:
        result.couriers,
    });
  } catch (error) {
    console.error(
      "Delivery Estimate Error:",
      error
    );

    next(error);
  }
}

/* =====================================================
   🚚 SERVICEABILITY CHECK
===================================================== */

export async function checkDeliveryServiceability(
  req,
  res,
  next
) {
  try {
    const {
      pincode,
      weight = 0.5,
      cod = false,
    } = req.body;

    /* =========================================
       ❌ VALIDATION
    ========================================= */

    if (!pincode) {
      return res.status(400).json({
        success: false,

        message:
          "Pincode required",
      });
    }

    /* =========================================
       🚚 FETCH COURIERS
    ========================================= */

    const couriers =
      await checkServiceability(
        pincode,
        {
          weight:
            Number(weight),

          cod: cod
            ? 1
            : 0,
        }
      );

    /* =========================================
       ❌ NOT SERVICEABLE
    ========================================= */

    if (
      !couriers ||
      couriers.length === 0
    ) {
      return res.status(404).json({
        success: false,

        serviceable: false,

        message:
          "Pincode not serviceable",
      });
    }

    /* =========================================
       ✅ RESPONSE
    ========================================= */

    return res.json({
      success: true,

      serviceable: true,

      courier_count:
        couriers.length,

      cod_available:
        couriers.some(
          (courier) =>
            courier.cod === 1
        ),

      couriers:
        couriers.map(
          (courier) => ({
            courier_name:
              courier.courier_name,

            etd:
              courier.etd ||
              "N/A",

            rate:
              courier.rate,

            rating:
              courier.rating,

            cod:
              courier.cod,

            estimated_delivery_days:
              courier.estimated_delivery_days,
          })
        ),
    });
  } catch (error) {
    console.error(
      "Serviceability Error:",
      error
    );

    next(error);
  }
}
