// scratch/test-vault-extended.js
import prisma from '../src/lib/prisma.js';
import { vaultService } from '../src/modules/vault/vault.service.js';

async function runTests() {
  console.log('=== EXTENDED DOCUMENT TYPE FILTER UAT VERIFICATION ===\n');

  // Setup Tenant & Client
  let tenant = await prisma.tenant.findFirst({ where: { slug: 'tenant-a' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'Tenant A', slug: 'tenant-a', status: 'ACTIVE' }
    });
  }

  let user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'userA@tenant-a.com',
        firstName: 'UserA',
        lastName: 'Test',
        passwordHash: 'dummyhash',
        role: 'DIETITIAN',
        status: 'ACTIVE'
      }
    });
  }

  let client = await prisma.client.findFirst({ where: { tenantId: tenant.id } });
  if (!client) {
    client = await prisma.client.create({
      data: { tenantId: tenant.id, firstName: 'ClientA', lastName: 'Test', status: 'ACTIVE' }
    });
  }

  console.log(`Tenant: ${tenant.name} (ID: ${tenant.id})`);
  console.log(`Client: ${client.firstName} (ID: ${client.id})`);
  console.log('--------------------------------------------------\n');

  // Create Word Asset
  const wordAsset = await prisma.fileAsset.create({
    data: {
      tenantId: tenant.id,
      entityType: 'CLIENT',
      entityId: client.id,
      folder: 'nutri-diet/tenants/a',
      publicId: 'test_word_asset',
      resourceType: 'raw',
      fileName: 'word_report',
      originalName: 'MedicalReport.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
      fileSize: 2048,
      url: 'http://cloudinary/word',
      secureUrl: 'https://cloudinary/word',
      uploadedBy: user.id,
      visibility: 'PRIVATE',
      status: 'ACTIVE'
    }
  });

  // Create Excel Asset
  const excelAsset = await prisma.fileAsset.create({
    data: {
      tenantId: tenant.id,
      entityType: 'CLIENT',
      entityId: client.id,
      folder: 'nutri-diet/tenants/a',
      publicId: 'test_excel_asset',
      resourceType: 'raw',
      fileName: 'excel_report',
      originalName: 'LabsSpreadsheet.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      fileSize: 4096,
      url: 'http://cloudinary/excel',
      secureUrl: 'https://cloudinary/excel',
      uploadedBy: user.id,
      visibility: 'PRIVATE',
      status: 'ACTIVE'
    }
  });

  // Create PDF Asset to differentiate
  const pdfAsset = await prisma.fileAsset.create({
    data: {
      tenantId: tenant.id,
      entityType: 'CLIENT',
      entityId: client.id,
      folder: 'nutri-diet/tenants/a',
      publicId: 'test_pdf_asset',
      resourceType: 'raw',
      fileName: 'pdf_report',
      originalName: 'IntakeForm.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      fileSize: 1024,
      url: 'http://cloudinary/pdf',
      secureUrl: 'https://cloudinary/pdf',
      uploadedBy: user.id,
      visibility: 'PRIVATE',
      status: 'ACTIVE'
    }
  });

  // Create Vault documents
  const docWord = await vaultService.createDocument({
    assetId: wordAsset.id,
    category: 'GENERAL',
    description: 'Word doc'
  }, { tenantId: tenant.id, clientId: client.id });

  const docExcel = await vaultService.createDocument({
    assetId: excelAsset.id,
    category: 'DIET_HISTORY',
    description: 'Excel doc'
  }, { tenantId: tenant.id, clientId: client.id });

  const docPdf = await vaultService.createDocument({
    assetId: pdfAsset.id,
    category: 'CONSENT_FORM',
    description: 'PDF doc'
  }, { tenantId: tenant.id, clientId: client.id });

  try {
    // 1. Fetch with type=WORD
    console.log('Fetching with type=WORD...');
    const listWord = await vaultService.getClientVault(client.id, tenant.id, { type: 'WORD' });
    console.log(`Retrieved ${listWord.length} WORD documents.`);
    if (listWord.length !== 1 || listWord[0].id !== docWord.id) {
      throw new Error('WORD filter failed to retrieve exactly the word document');
    }
    console.log('✅ SUCCESS: type=WORD filter behaves correctly!');

    // 2. Fetch with type=EXCEL
    console.log('Fetching with type=EXCEL...');
    const listExcel = await vaultService.getClientVault(client.id, tenant.id, { type: 'EXCEL' });
    console.log(`Retrieved ${listExcel.length} EXCEL documents.`);
    if (listExcel.length !== 1 || listExcel[0].id !== docExcel.id) {
      throw new Error('EXCEL filter failed to retrieve exactly the excel document');
    }
    console.log('✅ SUCCESS: type=EXCEL filter behaves correctly!');

    // 3. Fetch with type=PDF
    console.log('Fetching with type=PDF...');
    const listPdf = await vaultService.getClientVault(client.id, tenant.id, { type: 'PDF' });
    console.log(`Retrieved ${listPdf.length} PDF documents.`);
    if (listPdf.length !== 1 || listPdf[0].id !== docPdf.id) {
      throw new Error('PDF filter failed to retrieve exactly the pdf document');
    }
    console.log('✅ SUCCESS: type=PDF filter behaves correctly!');

  } finally {
    // Cleanup
    console.log('\nCleaning up database assets...');
    await prisma.vaultDocument.deleteMany({
      where: { id: { in: [docWord.id, docExcel.id, docPdf.id] } }
    });
    await prisma.fileAsset.deleteMany({
      where: { id: { in: [wordAsset.id, excelAsset.id, pdfAsset.id] } }
    });
    console.log('✅ Cleanup completed successfully!');
  }

  console.log('\n==================================================');
  console.log('ALL EXTENDED VAULT UAT FILTERS PASSED SUCCESSFULLY! ✓');
  console.log('==================================================');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
