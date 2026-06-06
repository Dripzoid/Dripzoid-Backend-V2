import {
  checkServiceability,
  getDeliveryEstimateService,
  getTrackingDetails,
  getInvoiceUrl,
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

    const length =
      Number(
        req.query.length
      ) || 10;

    const breadth =
      Number(
        req.query.breadth
      ) || 10;

    const height =
      Number(
        req.query.height
      ) || 5;

    const declared_value =
      Number(
        req.query.declared_value
      ) || 500;

    const mode =
      req.query.mode ||
      "Surface";

    /* =========================================
       📦 GET ESTIMATE
    ========================================= */

    const result =
      await getDeliveryEstimateService(
        pincode,
        {
          weight,
          cod,

          length,
          breadth,
          height,

          declared_value,

          mode,
        }
      );

    console.log(
      "📦 Delivery Estimate Result:",
      JSON.stringify(
        result,
        null,
        2
      )
    );

    /* =========================================
       ❌ NOT SERVICEABLE
    ========================================= */

    if (
      !result ||
      !result.serviceable
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

    return res.status(200).json({
      success: true,

      serviceable: true,

      estimated_delivery:
        result.estimated_delivery,

      fastest_courier:
        result.fastest_courier,

      cod_available:
        result.cod_available,

      courier_count:
        result.courier_count,

      couriers:
        result.couriers,
    });
  } catch (error) {
    console.error(
      "❌ Delivery Estimate Error:",
      error?.response?.data ||
        error.message ||
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

      length = 10,

      breadth = 10,

      height = 5,

      declared_value = 500,

      mode = "Surface",
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
       🚚 CHECK SERVICEABILITY
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

          length:
            Number(length),

          breadth:
            Number(breadth),

          height:
            Number(height),

          declared_value:
            Number(
              declared_value
            ),

          mode,
        }
      );

    console.log(
      "🚚 Serviceability Couriers:",
      JSON.stringify(
        couriers,
        null,
        2
      )
    );

    /* =========================================
       ❌ NO COURIERS
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

    /* =========================================
       💰 CHEAPEST COURIER
    ========================================= */

    const cheapest =
      couriers.reduce(
        (best, current) => {

          if (!best) {
            return current;
          }

          const currentRate =
            Number(
              current.rate
            ) || 999999;

          const bestRate =
            Number(
              best.rate
            ) || 999999;

          return currentRate <
            bestRate
            ? current
            : best;
        },
        null
      );

    /* =========================================
       ✅ RESPONSE
    ========================================= */

    return res.status(200).json({
      success: true,

      serviceable: true,

      courier_count:
        couriers.length,

      cod_available:
        couriers.some(
          (courier) =>
            courier.cod === 1
        ),

      fastest_courier:
        fastest
          ? {
              courier_name:
                fastest.courier_name,

              etd:
                fastest.etd,

              rate:
                fastest.rate,
            }
          : null,

      cheapest_courier:
        cheapest
          ? {
              courier_name:
                cheapest.courier_name,

              etd:
                cheapest.etd,

              rate:
                cheapest.rate,
            }
          : null,

      couriers:
        couriers.map(
          (courier) => ({
            courier_company_id:
              courier.courier_company_id,

            courier_name:
              courier.courier_name,

            etd:
              courier.etd ||
              "N/A",

            estimated_delivery_days:
              courier.estimated_delivery_days,

            rate:
              courier.rate,

            freight_charge:
              courier.freight_charge,

            cod:
              courier.cod,

            rating:
              courier.rating,

            realtime_tracking:
              courier.realtime_tracking,

            delivery_performance:
              courier.delivery_performance,

            pickup_performance:
              courier.pickup_performance,

            rto_performance:
              courier.rto_performance,

            is_surface:
              courier.is_surface,

            is_rto_address_available:
              courier.is_rto_address_available,
          })
        ),
    });
  } catch (error) {
    console.error(
      "❌ Serviceability Error:",
      error?.response?.data ||
        error.message ||
        error
    );

    next(error);
  }
}

/* =====================================================
   📍 TRACK SHIPMENT
===================================================== */

export async function trackOrderShipment(
  req,
  res,
  next
) {
  try {
    const { awb } =
      req.params;

    if (!awb) {
      return res.status(400).json({
        success: false,
        message: "AWB required",
      });
    }

    const tracking =
      await getTrackingDetails(
        awb
      );

    return res.status(200).json({
      success: true,
      tracking,
    });
  } catch (error) {
    console.error(
      "❌ Tracking Error:",
      error?.response?.data ||
        error.message
    );

    next(error);
  }
}

/* =====================================================
   🧾 DOWNLOAD INVOICE
===================================================== */

export async function downloadInvoice(
  req,
  res,
  next
) {
  try {
    const { orderId } =
      req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message:
          "Order ID required",
      });
    }

    const invoice =
      await getInvoiceUrl(
        orderId
      );

    return res.status(200).json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error(
      "❌ Invoice Error:",
      error?.response?.data ||
        error.message
    );

    next(error);
  }
}
