// src/modules/ai/ai.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Service logic for Ollama AI integration.
// ─────────────────────────────────────────────────────────────────────────────
import { Ollama } from 'ollama';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

const ollama = new Ollama({ host: env.OLLAMA_HOST });
const MODEL = env.OLLAMA_MODEL;

export const aiService = {
  /**
   * Sends a structured messages array to local Ollama and returns the assistant reply.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @returns {Promise<string>}
   */
  async chatWithAI(messages) {
    try {
      logger.info(`Sending chat request to Ollama model "${MODEL}" at "${env.OLLAMA_HOST}"`);
      
      const response = await ollama.chat({
        model: MODEL,
        messages,
        stream: false,
      });

      return response.message.content;
    } catch (error) {
      logger.error('Error during Ollama chat request:', error);
      throw error;
    }
  },
};
