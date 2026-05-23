import { uploadImageService }
from "./upload.service.js";

// ☁️ Upload image
export const uploadImage = async (
  req,
  res
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message:
          "No file uploaded",
      });
    }

    const result =
      await uploadImageService(
        req.file.path
      );

    res.json({
      message:
        "Upload successful",

      image: result,
    });
  } catch (err) {
    console.error(
      "uploadImage error:",
      err
    );

    res.status(500).json({
      message:
        err.message ||
        "Upload failed",
    });
  }
};