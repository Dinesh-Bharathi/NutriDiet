// scratch/test-labs-vault-link.js
import prisma from '../src/lib/prisma.js';
import { clinicalProfileRepository } from '../src/modules/assessments/clinical-profile.repository.js';

async function runLinkageTest() {
  console.log('=== STARTING LABS TO VAULT LINKAGE INTEGRATION TEST ===\n');

  // 1. Resolve or create test tenant, client, and client profile
  let tenant = await prisma.tenant.findFirst({ where: { slug: 'test-tenant-linkage' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'Linkage Test Tenant', slug: 'test-tenant-linkage', status: 'ACTIVE' }
    });
  }

  let user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'linkage-practitioner@test.com',
        firstName: 'Practitioner',
        lastName: 'Linkage',
        passwordHash: 'dummyhash',
        role: 'DIETITIAN',
        status: 'ACTIVE'
      }
    });
  }

  let client = await prisma.client.findFirst({ where: { tenantId: tenant.id } });
  if (!client) {
    client = await prisma.client.create({
      data: { tenantId: tenant.id, firstName: 'ClientLink', lastName: 'Test', status: 'ACTIVE' }
    });
  }

  let profile = await prisma.clientClinicalProfile.findFirst({ where: { tenantId: tenant.id, clientId: client.id } });
  if (!profile) {
    profile = await prisma.clientClinicalProfile.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        createdById: user.id
      }
    });
  }

  console.log(`Resolved Tenant ID: ${tenant.id}`);
  console.log(`Resolved Client ID: ${client.id}`);
  console.log(`Resolved Profile ID: ${profile.id}\n`);

  // 2. Create FileAsset & VaultDocument
  console.log('[Step 1] Creating temporary FileAsset...');
  const asset = await prisma.fileAsset.create({
    data: {
      tenantId: tenant.id,
      entityType: 'CLIENT',
      entityId: client.id,
      folder: 'nutri-diet/tenants/test-linkage',
      publicId: 'test_linkage_asset',
      resourceType: 'raw',
      fileName: 'lab_report_pdf',
      originalName: 'LabReport.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      fileSize: 2048,
      url: 'https://cloudinary/test-linkage',
      secureUrl: 'https://cloudinary/test-linkage',
      uploadedBy: user.id,
      visibility: 'PRIVATE',
      status: 'ACTIVE'
    }
  });

  console.log('[Step 2] Creating VaultDocument...');
  const vaultDoc = await prisma.vaultDocument.create({
    data: {
      tenantId: tenant.id,
      clientId: client.id,
      assetId: asset.id,
      category: 'BLOODWORK',
      description: 'Comprehensive metabolic panel'
    }
  });
  console.log(`Vault Document created with ID: ${vaultDoc.id}`);

  // 3. Create linked ClientLabResult
  console.log('\n[Step 3] Creating ClientLabResult linked to the VaultDocument...');
  const labResult = await clinicalProfileRepository.createLabResult(tenant.id, profile, {
    markerKey: 'hba1c',
    markerName: 'HbA1c',
    valueNumeric: 5.6,
    unit: '%',
    resultDate: new Date(),
    isAbnormal: false,
    notes: 'Intake test',
    vaultDocumentId: vaultDoc.id,
    documentPageReference: 'Page 2, Row 4'
  });

  console.log(`Lab result created with ID: ${labResult.id}`);
  console.log(`Attached vaultDocumentId: ${labResult.vaultDocumentId}`);
  console.log(`Attached pageReference: ${labResult.documentPageReference}`);

  // 4. Retrieve lab result and inspect joins
  console.log('\n[Step 4] Retrieving lab results to verify relation join...');
  const resultsList = await clinicalProfileRepository.getLabResults(tenant.id, profile.id);
  const fetchedLab = resultsList.find(r => r.id === labResult.id);

  if (!fetchedLab) {
    throw new Error('Could not find created lab result in list!');
  }

  console.log('Relation fetch validation:');
  console.log(`- vaultDocument found: ${!!fetchedLab.vaultDocument}`);
  console.log(`- asset found: ${!!fetchedLab.vaultDocument?.asset}`);
  console.log(`- asset file name: ${fetchedLab.vaultDocument?.asset?.originalName}`);

  if (!fetchedLab.vaultDocument || fetchedLab.vaultDocument.id !== vaultDoc.id) {
    throw new Error('Vault document relation was not correctly fetched/associated!');
  }
  if (!fetchedLab.vaultDocument.asset || fetchedLab.vaultDocument.asset.id !== asset.id) {
    throw new Error('Vault document nested asset relation was not correctly fetched/associated!');
  }
  console.log('✅ Relation join successfully verified!');

  // 5. Test cascade safety onDelete: SetNull
  console.log('\n[Step 5] Triggering VaultDocument deletion to test onDelete: SetNull cascade safety...');
  // Hard delete VaultDocument to trigger database level cascade onDelete: SetNull
  await prisma.vaultDocument.delete({
    where: { id: vaultDoc.id }
  });
  console.log('VaultDocument deleted from database.');

  // Refetch the lab result to ensure it still exists and vaultDocumentId is null
  const refetchedLab = await prisma.clientLabResult.findUnique({
    where: { id: labResult.id }
  });

  if (!refetchedLab) {
    throw new Error('❌ FAIL: Lab result was deleted alongside the vault document! Cascade was not SetNull.');
  }

  console.log('Refetched Lab result checks:');
  console.log(`- labResult ID: ${refetchedLab.id} (exists)`);
  console.log(`- vaultDocumentId: ${refetchedLab.vaultDocumentId} (expected: null)`);

  if (refetchedLab.vaultDocumentId !== null) {
    throw new Error('❌ FAIL: vaultDocumentId was not set to null after deletion!');
  }
  console.log('✅ SUCCESS: Cascade safety (onDelete: SetNull) verified! Lab record preserved.');

  // 6. Cleanup
  console.log('\n[Step 6] Cleaning up test records...');
  await prisma.clientLabResult.delete({ where: { id: labResult.id } });
  await prisma.fileAsset.delete({ where: { id: asset.id } });
  console.log('Test cleanups completed.');

  console.log('\n==================================================');
  console.log('ALL LABS-TO-VAULT LINKAGE INTEGRATION TESTS PASSED! ✓');
  console.log('==================================================');
}

runLinkageTest().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
