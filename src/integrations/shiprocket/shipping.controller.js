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

    const result =
      await getDeliveryEstimateService(
        pincode,
        {
          weight,
          cod,
        }
      );

    if (
      !result.serviceable
    ) {
      return res.status(404).json({
        success: false,

        serviceable: false,

        message:
          "Delivery unavailable",
      });
    }

    return res.json(result);
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
