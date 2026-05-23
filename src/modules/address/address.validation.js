import { z } from "zod";

export const addressSchema =
  z.object({
    name:
      z.string().min(1),

    label:
      z.string().optional(),

    line1:
      z.string().min(1),

    line2:
      z.string().optional(),

    city:
      z.string().min(1),

    state:
      z.string().min(1),

    pincode:
      z.string().min(1),

    country:
      z.string().default(
        "India"
      ),

    phone:
      z.string().optional(),

    isDefault:
      z.boolean().optional(),
  });