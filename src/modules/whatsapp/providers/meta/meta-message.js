export const metaMessageFormatter = {
  /**
   * Format a plain text message payload.
   */
  text(toPhone, body, replyToMetaMessageId = null) {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "text",
      text: {
        preview_url: false,
        body: body,
      },
    };
    if (replyToMetaMessageId) {
      payload.context = { message_id: replyToMetaMessageId };
    }
    return payload;
  },

  /**
   * Format a template message payload.
   */
  template(toPhone, templateName, languageCode = "en_US", components = null, replyToMetaMessageId = null) {
    const templatePayload = {
      name: templateName,
      language: {
        code: languageCode,
      },
    };

    if (components) {
      templatePayload.components = components;
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "template",
      template: templatePayload,
    };

    if (replyToMetaMessageId) {
      payload.context = { message_id: replyToMetaMessageId };
    }
    return payload;
  },

  /**
   * Format a media attachment payload (image, document, audio, video).
   */
  media(toPhone, mediaType, mediaUrl, caption = null, fileName = null, replyToMetaMessageId = null) {
    const type = mediaType.toLowerCase(); // 'image' | 'document' | 'audio' | 'video' | 'voice'
    const mediaObject = {
      link: mediaUrl,
    };

    if (caption && ['image', 'video', 'document'].includes(type)) {
      mediaObject.caption = caption;
    }

    if (type === "document" && fileName) {
      mediaObject.filename = fileName;
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: type === 'voice' ? 'audio' : type,
      [type === 'voice' ? 'audio' : type]: mediaObject,
    };

    if (replyToMetaMessageId) {
      payload.context = { message_id: replyToMetaMessageId };
    }
    return payload;
  },

  /**
   * Format a location message payload.
   */
  location(toPhone, latitude, longitude, name = null, address = null, replyToMetaMessageId = null) {
    const locationObject = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    };

    if (name) locationObject.name = name;
    if (address) locationObject.address = address;

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "location",
      location: locationObject,
    };

    if (replyToMetaMessageId) {
      payload.context = { message_id: replyToMetaMessageId };
    }
    return payload;
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
