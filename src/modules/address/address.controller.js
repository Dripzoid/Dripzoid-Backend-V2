import {
  createAddress,
  deleteAddress,
  getAddresses,
  getDefaultAddress,
  updateAddress,
} from "./address.service.js";

import {
  addressSchema,
} from "./address.validation.js";

export async function getAllAddresses(
  req,
  res,
  next
) {
  try {
    const addresses =
      await getAddresses(
        req.user.id
      );

    return res.json(addresses);
  } catch (err) {
    next(err);
  }
}

export async function addAddress(
  req,
  res,
  next
) {
  try {
    const validated =
      addressSchema.parse(
        req.body
      );

    const address =
      await createAddress(
        req.user.id,
        validated
      );

    return res
      .status(201)
      .json(address);
  } catch (err) {
    next(err);
  }
}

export async function editAddress(
  req,
  res,
  next
) {
  try {
    const validated =
      addressSchema.parse(
        req.body
      );

    const address =
      await updateAddress(
        req.params.id,
        req.user.id,
        validated
      );

    if (!address) {
      return res
        .status(404)
        .json({
          message:
            "Address not found",
        });
    }

    return res.json(address);
  } catch (err) {
    next(err);
  }
}

export async function removeAddress(
  req,
  res,
  next
) {
  try {
    const deleted =
      await deleteAddress(
        req.params.id,
        req.user.id
      );

    if (!deleted) {
      return res
        .status(404)
        .json({
          message:
            "Address not found",
        });
    }

    return res.json({
      message:
        "Address deleted successfully",
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserDefaultAddress(
  req,
  res,
  next
) {
  try {
    const address =
      await getDefaultAddress(
        req.user.id
      );

    return res.json(
      address || {}
    );
  } catch (err) {
    next(err);
  }
}