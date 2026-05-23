import fs from "fs/promises";

import cloudinary
from "../../config/cloudinary.js";

// ☁️ Upload image
export async function uploadImageService(
  localPath,
  folder = "dripzoid"
) {
  if (!localPath) {
    throw new Error(
      "No local file path"
    );
  }

  try {
    const result =
      await cloudinary.uploader.upload(
        localPath,
        {
          folder,
        }
      );

    // cleanup temp file
    await fs.unlink(localPath).catch(
      () => {}
    );

    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (err) {
    await fs.unlink(localPath).catch(
      () => {}
    );

    throw err;
  }
}