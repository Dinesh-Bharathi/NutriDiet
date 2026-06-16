export const metaMessageFormatter = {
  /**
   * Format a plain text message payload.
   */
  text(toPhone, body) {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "text",
      text: {
        preview_url: false,
        body: body,
      },
    };
  },

  /**
   * Format a template message payload.
   */
  template(toPhone, templateName, languageCode = "en_US", components = null) {
    const templatePayload = {
      name: templateName,
      language: {
        code: languageCode,
      },
    };

    if (components) {
      templatePayload.components = components;
    }

    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "template",
      template: templatePayload,
    };
  },

  /**
   * Format a media attachment payload (image, document, audio, video).
   */
  media(toPhone, mediaType, mediaUrl, fileName = null) {
    const type = mediaType.toLowerCase(); // 'image' | 'document' | 'audio' | 'video'
    const mediaObject = {
      link: mediaUrl,
    };

    if (type === "document" && fileName) {
      mediaObject.filename = fileName;
    }

    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: type,
      [type]: mediaObject,
    };
  },

  /**
   * Format a read receipt status update payload.
   */
  readReceipt(messageId) {
    return {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    };
  },
};
