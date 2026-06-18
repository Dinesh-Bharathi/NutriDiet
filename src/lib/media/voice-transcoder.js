/**
 * Voice Transcoder Utility
 *
 * Converts browser-recorded audio (audio/mp4, audio/webm) to OGG/Opus format
 * required for WhatsApp voice note playback on mobile devices.
 *
 * Uses fluent-ffmpeg + @ffmpeg-installer/ffmpeg (self-contained binary, no system install needed).
 */

import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { createRequire } from "module";
import path from "path";
import logger from "../../utils/logger.js";

// Point fluent-ffmpeg at the bundled binary
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Set ffprobe path if @ffprobe-installer is available
const _require = createRequire(import.meta.url);
try {
  const ffprobeInstaller = _require("@ffprobe-installer/ffprobe");
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
} catch {
  logger.warn("[VOICE_TRANSCODER] @ffprobe-installer/ffprobe not found — audio info extraction uses ffmpeg fallback");
}

/**
 * Transcode any audio file to OGG/Opus format suitable for WhatsApp voice notes.
 *
 * Target spec:
 *   Container:   OGG
 *   Codec:       libopus
 *   Bitrate:     32k (voice-optimized)
 *   VBR:         on
 *   Channels:    1 (mono)
 *   Sample rate: 48000 Hz
 *
 * @param {string} inputPath  - Absolute path to the source audio file
 * @param {string} outputPath - Absolute path for the converted .ogg output file
 * @returns {Promise<void>}
 */
export function transcodeToOggOpus(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec("libopus")
      .audioBitrate("32k")
      .audioChannels(1)
      .audioFrequency(48000)
      .outputOptions(["-vbr on", "-application voip"])
      .format("ogg")
      .output(outputPath)
      .on("start", (cmd) => {
        logger.info("[VOICE_TRANSCODER] FFmpeg started", { cmd: cmd.substring(0, 200) });
      })
      .on("error", (err) => {
        logger.error("[VOICE_TRANSCODER] FFmpeg error", { error: err.message, inputPath });
        reject(err);
      })
      .on("end", () => {
        logger.info("[VOICE_TRANSCODER] FFmpeg completed", { outputPath });
        resolve();
      })
      .run();
  });
}

/**
 * Extract audio codec/format metadata from a file using ffprobe.
 * Returns a structured diagnostic object.
 *
 * @param {string} filePath - Absolute path to the audio file
 * @returns {Promise<{container: string, codec: string, sampleRate: string, channels: string, duration: string, bitRate: string}>}
 */
export function getAudioInfo(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata) {
        logger.warn("[VOICE_TRANSCODER] ffprobe failed — returning unknown metadata", {
          error: err?.message,
          filePath,
        });
        resolve({
          container: path.extname(filePath).replace(".", "") || "unknown",
          codec: "unknown",
          sampleRate: "unknown",
          channels: "unknown",
          duration: "unknown",
          bitRate: "unknown",
        });
        return;
      }

      const format = metadata.format || {};
      const audioStream = (metadata.streams || []).find((s) => s.codec_type === "audio") || {};

      resolve({
        container: (format.format_name || "").split(",")[0] || "unknown",
        codec: audioStream.codec_name || "unknown",
        sampleRate: audioStream.sample_rate ? `${audioStream.sample_rate} Hz` : "unknown",
        channels: audioStream.channels ? String(audioStream.channels) : "unknown",
        duration: format.duration ? `${parseFloat(format.duration).toFixed(2)}s` : "unknown",
        bitRate: format.bit_rate ? `${Math.round(format.bit_rate / 1000)}kbps` : "unknown",
      });
    });
  });
}
