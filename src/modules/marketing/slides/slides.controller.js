import {
  getPublicSlidesService,
  getAdminSlidesService,
  createSlideService,
  updateSlideService,
  deleteSlideService,
} from "./slides.service.js";

// 📦 PUBLIC
export const getPublicSlides = async (
  req,
  res
) => {
  try {
    const data =
      await getPublicSlidesService();

    res.json(data);
  } catch (err) {
    console.error(
      "getPublicSlides error:",
      err
    );

    res.status(500).json({
      message:
        err.message ||
        "Failed to fetch slides",
    });
  }
};

// 📦 ADMIN
export const getAdminSlides = async (
  req,
  res
) => {
  try {
    const data =
      await getAdminSlidesService();

    res.json(data);
  } catch (err) {
    console.error(
      "getAdminSlides error:",
      err
    );

    res.status(500).json({
      message:
        err.message ||
        "Failed to fetch slides",
    });
  }
};

// ➕ CREATE
export const createSlide = async (
  req,
  res
) => {
  try {
    const data =
      await createSlideService(
        req.body
      );

    res.status(201).json({
      message: "Slide added",
      slide: data,
    });
  } catch (err) {
    console.error(
      "createSlide error:",
      err
    );

    res.status(400).json({
      message:
        err.message ||
        "Failed to create slide",
    });
  }
};

// ✏️ UPDATE
export const updateSlide = async (
  req,
  res
) => {
  try {
    await updateSlideService(
      req.params.id,
      req.body
    );

    res.json({
      message: "Slide updated",
    });
  } catch (err) {
    console.error(
      "updateSlide error:",
      err
    );

    res.status(400).json({
      message:
        err.message ||
        "Failed to update slide",
    });
  }
};

// ❌ DELETE
export const deleteSlide = async (
  req,
  res
) => {
  try {
    await deleteSlideService(
      req.params.id
    );

    res.json({
      message:
        "Slide soft-deleted",
    });
  } catch (err) {
    console.error(
      "deleteSlide error:",
      err
    );

    res.status(500).json({
      message:
        err.message ||
        "Failed to delete slide",
    });
  }
};