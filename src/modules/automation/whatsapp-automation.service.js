// src/modules/automation/whatsapp-automation.service.js

import prisma from '../../lib/prisma.js';
import crypto from 'crypto';
import { MetaClient } from '../whatsapp/providers/meta/meta-client.js';
import { decrypt } from '../../utils/encryption.js';
import logger from '../../utils/logger.js';

export const whatsappAutomationService = {
  /**
   * Sends an automated reminder using WhatsApp interactive button/list layout.
   */
  async sendAutomationReminder(tenantId, { clientId, compiledMessage, buttons, reminderJobId, jobType }) {
    // 1. Pre-flight checks
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { tenantId },
    });

    if (!connection || connection.status !== 'CONNECTED') {
      logger.warn(`[AUTOMATION_SEND] Tenant ${tenantId} does not have an active CONNECTED WhatsApp connection. Skipping.`);
      return { skipped: true, reason: 'NO_CONNECTION' };
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client || !client.phone) {
      logger.warn(`[AUTOMATION_SEND] Client ${clientId} not found or phone number is missing. Skipping.`);
      return { skipped: true, reason: 'NO_PHONE' };
    }

    const conversation = await prisma.whatsAppConversation.findFirst({
      where: { tenantId, clientId },
    });

    if (!conversation) {
      logger.warn(`[AUTOMATION_SEND] Conversation not initialized for client ${clientId}. Skipping.`);
      return { skipped: true, reason: 'NO_CONVERSATION' };
    }

    // 2. Build Interactive Message Payload
    const toPhone = client.phone.replace(/[-\s()+]/g, '');
    let payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
    };

    const hasButtons = Array.isArray(buttons) && buttons.length > 0;
    
    if (hasButtons) {
      payload.type = 'interactive';
      if (buttons.length > 3) {
        // Build List Message (WhatsApp allows up to 10 options)
        payload.interactive = {
          type: 'list',
          body: {
            text: compiledMessage,
          },
          action: {
            button: 'Select Option',
            sections: [
              {
                title: 'Options',
                rows: buttons.map((btn, idx) => ({
                  id: btn.id || `v1_btn_${idx}`,
                  title: btn.text.slice(0, 24), // Max 24 characters for list titles
                })),
              },
            ],
          },
        };
      } else {
        // Build Quick Reply Buttons (WhatsApp allows up to 3 buttons)
        payload.interactive = {
          type: 'button',
          body: {
            text: compiledMessage,
          },
          action: {
            buttons: buttons.map((btn, idx) => ({
              type: 'reply',
              reply: {
                id: btn.id || `v1_btn_${idx}`,
                title: btn.text.slice(0, 20), // Max 20 characters for button titles
              },
            })),
          },
        };
      }
    } else {
      // Build plain Text Message
      payload.type = 'text';
      payload.text = {
        preview_url: false,
        body: compiledMessage,
      };
    }

    // 3. Dispatch to Meta API
    const decryptedToken = decrypt(connection.accessToken);
    const metaClient = new MetaClient(decryptedToken);

    logger.info(`[AUTOMATION_SEND] Dispatching reminder job ${reminderJobId} (Type: ${jobType}) to ${toPhone}`);

    const metaRes = await metaClient.sendMessage(connection.phoneNumberId, payload);
    const metaMessageId = metaRes.messages?.[0]?.id;

    if (!metaMessageId) {
      throw new Error('Meta Graph API returned an empty message list without wamid.');
    }

    // 4. Save Outbound Message to Database
    const previewText = compiledMessage.slice(0, 499);
    const savedMessage = await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        metaMessageId,
        direction: 'OUTBOUND',
        type: hasButtons ? 'INTERACTIVE' : 'TEXT',
        status: 'SENT',
        senderType: 'SYSTEM',
        source: 'AUTOMATION',
        body: compiledMessage,
        previewText,
        senderName: 'NutriDiet Automation',
        senderPhone: connection.displayPhoneNumber || '',
        sentAt: new Date(),
        interactivePayload: hasButtons ? payload.interactive : null,
      },
    });

    // Update conversation metadata
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageId: savedMessage.id,
        lastMessageText: previewText,
        lastMessageAt: new Date(),
      },
    });

    return { skipped: false, metaMessageId, messageId: savedMessage.id };
  },
};
