import {
  getAvailableCouriers,
  checkServiceability,
} from "../../lib/shiprocket.js";

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
       🚚 FETCH COURIERS
    ========================================= */

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

    const couriers =
      response?.data
        ?.available_courier_companies ||
      [];

    /* =========================================
       ❌ NO SERVICE
    ========================================= */

    if (
      couriers.length === 0
    ) {
      return res.status(404).json({
        success: false,

        serviceable: false,

        message:
          "Delivery unavailable",
      });
    }

    /* =========================================
       ⚡ FASTEST COURIER
    ========================================= */

    const fastest =
      couriers.reduce(
        (best, current) => {
          if (
            !best ||
            Number(
              current.estimated_delivery_days
            ) <
              Number(
                best.estimated_delivery_days
              )
          ) {
            return current;
          }

          return best;
        },
        null
      );

    /* =========================================
       ✅ RESPONSE
    ========================================= */

    return res.json({
      success: true,

      serviceable: true,

      estimated_delivery:
        fastest?.etd ||
        `${fastest?.estimated_delivery_days} Days`,

      cod_available:
        couriers.some(
          (c) =>
            c.cod === 1
        ),

      courier_count:
        couriers.length,

      couriers:
        couriers.map(
          (courier) => ({
            courier_name:
              courier.courier_name,

            etd:
              courier.etd,

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

    if (!pincode) {
      return res.status(400).json({
        success: false,

        message:
          "Pincode required",
      });
    }

    /* =========================================
       🚚 FETCH SERVICEABILITY
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
          (c) =>
            c.cod === 1
        ),

      couriers:
        couriers.map(
          (courier) => ({
            courier_name:
              courier.courier_name,

            etd:
              courier.etd,

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
    next(error);
  }
}
