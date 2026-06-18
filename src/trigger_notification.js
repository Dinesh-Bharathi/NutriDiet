import { whatsappWebhookService } from "./modules/whatsapp/whatsapp-webhook.service.js";
import prisma from "./lib/prisma.js";

async function main() {
  console.log("Looking up database records...");
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error("No tenant found");
    return;
  }
  console.log("Found tenant:", tenant.id);
  
  const client = await prisma.client.findFirst({
    where: { tenantId: tenant.id }
  });
  if (!client) {
    console.error("No client found");
    return;
  }
  console.log("Found client:", client.id, `${client.firstName} ${client.lastName}`);

  let conversation = await prisma.whatsAppConversation.findFirst({
    where: { tenantId: tenant.id, clientId: client.id }
  });
  if (!conversation) {
    conversation = await prisma.whatsAppConversation.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        phone: client.phone || "1234567890",
        optInStatus: true,
      }
    });
  }
  console.log("Found/created conversation:", conversation.id);

  const savedMessage = await prisma.whatsAppMessage.create({
    data: {
      tenantId: tenant.id,
      conversationId: conversation.id,
      direction: "INBOUND",
      type: "TEXT",
      status: "DELIVERED",
      body: "Test message at " + new Date().toISOString(),
      senderPhone: client.phone || "1234567890",
      senderType: "CLIENT",
    }
  });
  console.log("Saved mock message:", savedMessage.id);

  console.log("Triggering notifications...");
  await whatsappWebhookService._createWhatsAppNotifications({
    tenantId: tenant.id,
    client,
    savedMessage,
    conversation,
    mappedType: "TEXT",
    previewText: savedMessage.body,
    wamid: "wamid-test-" + Date.now(),
  });

  console.log("Successfully triggered notifications!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
