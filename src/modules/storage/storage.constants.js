// src/modules/storage/storage.constants.js

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB default

export const SUPPORTED_RESOURCE_TYPES = ["image", "video", "raw"];

export const ALLOWED_MIME_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};

export const ALLOWED_EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "webp", "svg"],
  document: ["pdf", "doc", "docx", "xls", "xlsx", "csv"],
  video: ["mp4", "webm", "mov"],
};

export const FILE_VISIBILITY = {
  PUBLIC: "PUBLIC",
  PROTECTED: "PROTECTED",
  PRIVATE: "PRIVATE",
};

export const FILE_ENTITY_TYPE = {
  TENANT: "TENANT",
  USER: "USER",
  CLIENT: "CLIENT",
  ASSESSMENT: "ASSESSMENT",
  LAB_REPORT: "LAB_REPORT",
  DIET_PLAN: "DIET_PLAN",
  PACKAGE: "PACKAGE",
  PROGRAM: "PROGRAM",
  PROGRAM_CONTENT: "PROGRAM_CONTENT",
  APPOINTMENT: "APPOINTMENT",
  INVOICE: "INVOICE",
  OTHER: "OTHER",
};
