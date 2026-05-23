import multer from "multer";
import path from "path";
import fs from "fs";

// 📁 Temp upload dir
const TEMP_DIR = "temp";

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, {
    recursive: true,
  });
}

// 📦 Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },

  filename: (req, file, cb) => {
    const unique =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9);

    cb(
      null,
      unique +
        path.extname(file.originalname)
    );
  },
});

// 🔒 File filter
function fileFilter(req, file, cb) {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
  ];

  if (!allowed.includes(file.mimetype)) {
    return cb(
      new Error(
        "Only jpg, png, webp allowed"
      ),
      false
    );
  }

  cb(null, true);
}

// 🚀 Upload middleware
export const upload = multer({
  storage,

  limits: {
    fileSize:
      10 * 1024 * 1024,
  },

  fileFilter,
});