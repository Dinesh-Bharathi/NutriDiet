import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import crypto from "crypto";

export default class AwsS3Provider {
  constructor(config) {
    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl;
    this.client = new S3Client({
      region: config.region || "us-east-1",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  /**
   * Upload a file to AWS S3.
   * @param {object} file - Multer file object
   * @param {object} options - Upload options (e.g. folder name)
   * @returns {Promise<object>} - Storage upload result mimicking Cloudinary shape
   */
  async upload(file, options = {}) {
    const fileStream = fs.createReadStream(file.path);
    const uniqueName = `${crypto.randomUUID()}-${file.originalname}`;
    const key = options.folder ? `${options.folder}/${uniqueName}` : uniqueName;

    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: fileStream,
      ContentType: file.mimetype,
    };

    await this.client.send(new PutObjectCommand(uploadParams));

    const originalFilename = file.originalname.substring(0, file.originalname.lastIndexOf('.')) || file.originalname;

    return {
      public_id: key,
      asset_id: crypto.randomUUID(),
      original_filename: originalFilename,
      bytes: file.size,
      url: `${this.publicUrl}/${key}`,
      secure_url: `${this.publicUrl}/${key}`,
    };
  }

  /**
   * Delete a file from AWS S3.
   * @param {string} key - The object key (publicId)
   * @returns {Promise<object>} - Destruction result mimicking Cloudinary result
   */
  async delete(key) {
    const deleteParams = {
      Bucket: this.bucketName,
      Key: key,
    };
    await this.client.send(new DeleteObjectCommand(deleteParams));
    return { result: "ok" };
  }

  /**
   * Generate/get public or signed URL.
   * @param {string} key - The object key (publicId)
   * @param {object} options - Options (e.g., signed: true, expiresIn: 3600)
   * @returns {Promise<string>} - The URL
   */
  async getPublicUrl(key, options = {}) {
    if (options.signed) {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      return getSignedUrl(this.client, command, { expiresIn: options.expiresIn || 3600 });
    }
    return `${this.publicUrl}/${key}`;
  }
}
