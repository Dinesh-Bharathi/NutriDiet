// src/modules/ai/ai.controller.js
// ─────────────────────────────────────────────────────────────────────────────
// Express controller for AI-related endpoints.
// ─────────────────────────────────────────────────────────────────────────────
import { aiService } from './ai.service.js';
import { SYSTEM_PROMPT } from './ai.prompts.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const aiController = {
  /**
   * POST /api/v1/ai/chat
   * Conducts a chat iteration with the local Ollama LLM.
   */
  async chat(req, res) {
    const { message, history = [] } = req.body;

    // Construct the messages payload starting with the System Prompt
    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      ...history,
      {
        role: 'user',
        content: message,
      },
    ];

    try {
      const reply = await aiService.chatWithAI(messages);

      return sendSuccess(
        res,
        HTTP_STATUS.OK,
        'AI chat response generated successfully',
        { response: reply }
      );
    } catch (error) {
      // Wrap unexpected Ollama communication errors into standard ApiError envelope
      throw ApiError.internal('Failed to communicate with local AI service: ' + error.message);
    }
  },
};
