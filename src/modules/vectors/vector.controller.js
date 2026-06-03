import {
  getAllProductVectors,
  getAllKBVectors
} from "./vector.service.js";

export async function fetchProductVectors(
  req,
  res
) {
  try {

    const vectors =
      await getAllProductVectors();

    return res.status(200).json({
      success: true,
      count:
        vectors.length,
      vectors
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message
    });

  }
}

export async function fetchKBVectors(
  req,
  res
) {
  try {

    const vectors =
      await getAllKBVectors();

    return res.status(200).json({
      success: true,
      count:
        vectors.length,
      vectors
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message
    });

  }
}
