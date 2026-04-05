const asyncHandler = require("express-async-handler");
const cloudinary = require("../utils/cloudinary");

const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Image file is required",
    });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Image upload is not configured on the server (Cloudinary env vars missing)",
    });
  }

  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "blatheil/products",
          resource_type: "auto",
          quality: "auto",
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload stream error:", error);
            return reject(error);
          }
          resolve(result);
        }
      );

      stream.on("error", (error) => {
        console.error("Cloudinary stream error event:", error);
        reject(error);
      });

      stream.end(req.file.buffer);
    });

    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error("Upload succeeded but no secure URL returned");
    }

    return res.status(201).json({
      success: true,
      data: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      },
    });
  } catch (error) {
    console.error("Upload controller error:", {
      message: error.message,
      code: error.code,
      status: error.status,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
    });

    return res.status(502).json({
      success: false,
      message: `Failed to upload image: ${error.message}`,
    });
  }
});

// Upload multiple images
const uploadMultipleImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one image file is required",
    });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Image upload is not configured on the server (Cloudinary env vars missing)",
    });
  }

  try {
    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "blatheil/products",
            resource_type: "auto",
            quality: "auto",
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload stream error:", error);
              return reject(error);
            }
            resolve(result);
          }
        );

        stream.on("error", (error) => {
          console.error("Cloudinary stream error event:", error);
          reject(error);
        });

        stream.end(file.buffer);
      });
    });

    const uploadResults = await Promise.all(uploadPromises);

    // Validate all uploads
    uploadResults.forEach((result, index) => {
      if (!result || !result.secure_url) {
        throw new Error(`Upload ${index + 1} succeeded but no secure URL returned`);
      }
    });

    return res.status(201).json({
      success: true,
      data: uploadResults.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
      })),
    });
  } catch (error) {
    console.error("Multiple upload controller error:", {
      message: error.message,
      fileCount: req.files?.length,
    });

    return res.status(502).json({
      success: false,
      message: `Failed to upload images: ${error.message}`,
    });
  }
});

module.exports = { uploadImage, uploadMultipleImages };
