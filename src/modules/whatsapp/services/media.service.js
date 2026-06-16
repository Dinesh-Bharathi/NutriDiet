// src/modules/whatsapp/services/media.service.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import env from '../../../config/env.js';
import prisma from '../../../lib/prisma.js';
import { uploadAsset } from '../../storage/storage.service.js';
import { logWhatsApp } from '../whatsapp-logger.js';

const mimeToExt = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/3gpp': '3gp',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/amr': 'amr',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt',
};

export const mediaService = {
  /**
   * Download media from Meta and upload it to NutriDiet storage.
   * Streams download payload, stores temporarily, and uses unified upload flow.
   *
   * @param {string} tenantId
   * @param {string} mediaId
   * @param {string} accessToken - Decrypted Meta Access Token
   * @param {string} conversationId
   * @returns {Promise<object>} - Saved FileAsset record
   */
  async downloadAndStoreMedia(tenantId, mediaId, accessToken, conversationId) {
    logWhatsApp('[WHATSAPP_MEDIA]', { tenantId }, `Starting media download & store pipeline: mediaId=${mediaId}`);

    try {
      // 1. Fetch metadata from Meta Graph API
      const metaUrl = `${env.META_GRAPH_API_BASE_URL}/${env.META_GRAPH_API_VERSION}/${mediaId}`;
      logWhatsApp('[WHATSAPP_MEDIA]', { tenantId }, `Fetching media metadata from Meta: ${metaUrl}`);

      const metaResponse = await axios.get(metaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const metadata = metaResponse.data;

      if (!metadata.url) {
        throw new Error(`Meta media metadata did not return a download URL for mediaId=${mediaId}`);
      }

      logWhatsApp('[WHATSAPP_MEDIA]', { tenantId }, `Metadata retrieved: mimeType=${metadata.mime_type}, size=${metadata.file_size}`);

      // Determine extension and filename
      const ext = mimeToExt[metadata.mime_type] || metadata.mime_type?.split('/')?.[1] || 'bin';
      const fileName = `whatsapp_${mediaId}.${ext}`;

      // 2. Download Binary Payload via Stream
      logWhatsApp('[WHATSAPP_MEDIA]', { tenantId }, `Downloading binary payload from: ${metadata.url}`);
      const binaryResponse = await axios.get(metadata.url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'stream',
      });

      // 3. Pipe stream to a temporary local file (required by uploadAsset's fs.createReadStream)
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFilePath = path.join(tempDir, `${crypto.randomUUID()}-${fileName}`);
      const writer = fs.createWriteStream(tempFilePath);

      binaryResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      logWhatsApp('[WHATSAPP_MEDIA]', { tenantId }, `Binary payload successfully written to temp path: ${tempFilePath}`);

      // 4. Resolve Owner / Dietitian User to satisfy FileAsset.uploadedBy FK constraint
      const ownerUser = await prisma.user.findFirst({
        where: { tenantId, role: 'OWNER', deletedAt: null },
      }) || await prisma.user.findFirst({
        where: { tenantId, deletedAt: null },
      });

      if (!ownerUser) {
        throw new Error(`No active user found to attribute storage upload to for tenant ${tenantId}`);
      }

      // 5. Construct Mock Multer File Object
      const mockFile = {
        path: tempFilePath,
        originalname: fileName,
        mimetype: metadata.mime_type,
        size: metadata.file_size || fs.statSync(tempFilePath).size,
      };

      // 6. Call Unified Storage upload flow
      logWhatsApp('[WHATSAPP_MEDIA]', { tenantId }, `Uploading file asset to R2: entityType=WHATSAPP, entityId=${conversationId}`);
      const fileAsset = await uploadAsset(
        tenantId,
        ownerUser.id,
        mockFile,
        'WHATSAPP',
        conversationId,
        'PRIVATE'
      );

      logWhatsApp('[WHATSAPP_MEDIA]', { tenantId }, `Media upload successful: fileAssetId=${fileAsset.id}, url=${fileAsset.secureUrl}`);
      return fileAsset;
    } catch (err) {
      logWhatsApp('[WHATSAPP_MEDIA]', { tenantId }, `Media download & store failed: ${err.message}`, 'error');
      throw err;
    }
  },
};
