import env from "../../config/env.js";
import CloudflareR2Provider from "./providers/cloudflare-r2.js";

// Instantiate Cloudflare R2 provider by default
const storageProvider = new CloudflareR2Provider({
  endpoint: env.R2_ENDPOINT,
  bucketName: env.R2_BUCKET_NAME,
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  publicUrl: env.R2_PUBLIC_URL,
});

export default storageProvider;
