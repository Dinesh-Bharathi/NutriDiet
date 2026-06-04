import { v2 as cloudinary } from "cloudinary";
import env from "../config/env.js";
import logger from "../utils/logger.js";

// Cloudinary is configured via the CLOUDINARY_URL environment variable.
// No extra config is needed if env is set, but we can explicitly set it just in case.
if (env.CLOUDINARY_URL) {
  // It automatically picks it up, but just to be sure we are initialized
  logger.info("Cloudinary library initialized with CLOUDINARY_URL");
}

/**
 * Upload a file to Cloudinary.
 * @param {string} filePath - Path to the temporary file on disk (from multer)
 * @param {object} options - Upload options
 * @returns {Promise<object>} - Cloudinary upload result
 */
export async function uploadFile(filePath, options = {}) {
  try {
    const defaultOptions = {
      resource_type: "auto",
      // Set access mode based on visibility if needed (mostly handled via upload presets or delivery type)
    };

    const finalOptions = { ...defaultOptions, ...options };
    const result = await cloudinary.uploader.upload(filePath, finalOptions);
    return result;
  } catch (error) {
    logger.error("Cloudinary upload failed", { error: error.message, options });
    throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
  }
}

/**
 * Delete a file from Cloudinary.
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type (image, video, raw)
 * @param {string} type - Delivery type (upload, authenticated, private)
 * @returns {Promise<object>} - Cloudinary destruction result
 */
export async function deleteFile(publicId, resourceType = "image", type = "upload") {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: type,
    });
    return result;
  } catch (error) {
    logger.error("Cloudinary delete failed", { error: error.message, publicId });
    throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
  }
}

/**
 * Get asset metadata from Cloudinary.
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type
 * @returns {Promise<object>} - Asset details
 */
export async function getAssetMetadata(publicId, resourceType = "image") {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    logger.error("Cloudinary get metadata failed", { error: error.message, publicId });
    throw new Error(`Failed to get asset metadata from Cloudinary: ${error.message}`);
  }
}

/**
 * Generate a signed URL for a private/protected asset.
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type
 * @returns {string} - Signed URL
 */
export async function generateSignedUrl(publicId, resourceType = "image") {
  try {
    // We generate a URL that expires in 1 hour
    const url = cloudinary.url(publicId, {
      resource_type: resourceType,
      type: "authenticated",
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    });
    return url;
  } catch (error) {
    logger.error("Cloudinary signed URL generation failed", { error: error.message, publicId });
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

export default {
  uploadFile,
  deleteFile,
  getAssetMetadata,
  generateSignedUrl,
};
