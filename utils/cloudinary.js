const { v2: cloudinary } = require("cloudinary");

const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Validate config on startup
if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  console.warn("⚠️  WARNING: Cloudinary credentials are incomplete:", {
    cloud_name: !!cloudinaryConfig.cloud_name,
    api_key: !!cloudinaryConfig.api_key,
    api_secret: !!cloudinaryConfig.api_secret,
  });
}

cloudinary.config(cloudinaryConfig);

module.exports = cloudinary;
