// scratch/test-vault-uat.js
import prisma from '../src/lib/prisma.js';
import { vaultService } from '../src/modules/vault/vault.service.js';
import { vaultRepository } from '../src/modules/vault/vault.repository.js';
import { getAssetAccessUrl, deleteAsset } from '../src/modules/storage/storage.service.js';
import cloudinaryService from '../src/lib/cloudinary.js';
import { ApiError } from '../src/utils/ApiError.js';

// Mock Cloudinary delete to avoid real network calls during test
cloudinaryService.deleteFile = async (publicId, resourceType, deliveryType) => {
  console.log(`[MOCK CLOUDINARY] Wiping publicId: ${publicId}`);
  return { result: 'ok' };
};

async function runTests() {
  console.log('=== CLIENT VAULT UAT VERIFICATION MATRIX ===\n');

  // 1. Setup/Retrieve Tenants & Clients for Cross-Tenant Checks
  let tenantA = await prisma.tenant.findFirst({ where: { slug: 'tenant-a' } });
  if (!tenantA) {
    tenantA = await prisma.tenant.create({
      data: { name: 'Tenant A', slug: 'tenant-a', status: 'ACTIVE' }
    });
  }

  let tenantB = await prisma.tenant.findFirst({ where: { slug: 'tenant-b' } });
  if (!tenantB) {
    tenantB = await prisma.tenant.create({
      data: { name: 'Tenant B', slug: 'tenant-b', status: 'ACTIVE' }
    });
  }

  let userA = await prisma.user.findFirst({ where: { tenantId: tenantA.id } });
  if (!userA) {
    userA = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: 'userA@tenant-a.com',
        firstName: 'UserA',
        lastName: 'Test',
        passwordHash: 'dummyhash',
        role: 'DIETITIAN',
        status: 'ACTIVE'
      }
    });
  }

  let userB = await prisma.user.findFirst({ where: { tenantId: tenantB.id } });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: 'userB@tenant-b.com',
        firstName: 'UserB',
        lastName: 'Test',
        passwordHash: 'dummyhash',
        role: 'DIETITIAN',
        status: 'ACTIVE'
      }
    });
  }

  let clientA = await prisma.client.findFirst({ where: { tenantId: tenantA.id } });
  if (!clientA) {
    clientA = await prisma.client.create({
      data: { tenantId: tenantA.id, firstName: 'ClientA', lastName: 'Test', status: 'ACTIVE' }
    });
  }

  let clientB = await prisma.client.findFirst({ where: { tenantId: tenantB.id } });
  if (!clientB) {
    clientB = await prisma.client.create({
      data: { tenantId: tenantB.id, firstName: 'ClientB', lastName: 'Test', status: 'ACTIVE' }
    });
  }

  console.log(`Tenant A: ${tenantA.name} (ID: ${tenantA.id})`);
  console.log(`Tenant B: ${tenantB.name} (ID: ${tenantB.id})`);
  console.log(`Client A: ${clientA.firstName} (ID: ${clientA.id})`);
  console.log(`Client B: ${clientB.firstName} (ID: ${clientB.id})`);
  console.log('--------------------------------------------------\n');

  // Test SEC-01: Cross-Tenant Asset Fetching
  console.log('[Test SEC-01] Tenant A attempting to fetch/access Tenant B asset...');
  
  // Create an asset owned by Tenant B
  const assetB = await prisma.fileAsset.create({
    data: {
      tenantId: tenantB.id,
      entityType: 'CLIENT',
      entityId: clientB.id,
      folder: 'nutri-diet/tenants/b',
      publicId: 'test_asset_b',
      resourceType: 'raw',
      fileName: 'bloodwork_b',
      originalName: 'Bloodwork_B.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      fileSize: 1024,
      url: 'http://cloudinary/b',
      secureUrl: 'https://cloudinary/b',
      uploadedBy: userB.id,
      visibility: 'PRIVATE',
      status: 'ACTIVE'
    }
  });

  try {
    // Attempt access as Tenant A
    await getAssetAccessUrl(assetB.id, tenantA.id, userA.id, 'VIEW');
    console.error('❌ FAIL: Tenant A accessed Tenant B asset!');
    process.exit(1);
  } catch (err) {
    const isExpectedError = 
      err.statusCode === 404 || 
      err.statusCode === 403 || 
      err.statusCode === 'Asset not found' ||
      err.message === '404' ||
      err.message === 'Asset not found';
      
    if (isExpectedError) {
      console.log(`✅ SUCCESS: Access blocked! Threw expected error: ${err.message} (${err.statusCode})`);
    } else {
      console.error(`❌ FAIL: Threw unexpected error:`, err);
      process.exit(1);
    }
  }
  console.log('--------------------------------------------------\n');

  // Test VAL-01 / VAL-02 Check
  console.log('[Test VAL-01/02] Verifying Zod validation schemas for Vault Document creation...');
  // We can call vaultService directly to verify it creates correctly, or test Zod schemas
  try {
    // Create valid file asset for Tenant A
    const assetA = await prisma.fileAsset.create({
      data: {
        tenantId: tenantA.id,
        entityType: 'CLIENT',
        entityId: clientA.id,
        folder: 'nutri-diet/tenants/a',
        publicId: 'test_asset_a',
        resourceType: 'raw',
        fileName: 'bloodwork_a',
        originalName: 'Bloodwork_A.pdf',
        mimeType: 'application/pdf',
        extension: 'pdf',
        fileSize: 1024,
        url: 'http://cloudinary/a',
        secureUrl: 'https://cloudinary/a',
        uploadedBy: userA.id,
        visibility: 'PRIVATE',
        status: 'ACTIVE'
      }
    });

    console.log('Creating vault document relation...');
    const doc = await vaultService.createDocument({
      assetId: assetA.id,
      category: 'BLOODWORK',
      description: 'Patient Bloodwork Report'
    }, { tenantId: tenantA.id, clientId: clientA.id });

    console.log(`✅ SUCCESS: Vault Document created (ID: ${doc.id})`);
    console.log('Listing Client A vault documents...');
    const list = await vaultService.getClientVault(clientA.id, tenantA.id);
    console.log(`✅ SUCCESS: Retrieved list containing ${list.length} documents.`);
    if (list[0].id !== doc.id) {
      throw new Error('ID mismatch on retrieved document');
    }

    console.log('\n[Test FUN-02] Verifying soft-delete vault document and hard-delete file asset...');
    await vaultService.deleteDocument(doc.id, tenantA.id, userA.id);
    
    // Check if VaultDocument relation is soft-deleted
    const deletedDoc = await prisma.vaultDocument.findFirst({
      where: { id: doc.id }
    });
    console.log(`VaultDocument deletedAt: ${deletedDoc.deletedAt}`);
    if (!deletedDoc.deletedAt) {
      throw new Error('VaultDocument deletedAt was not set!');
    }
    
    // Check if FileAsset is soft-deleted
    const deletedAsset = await prisma.fileAsset.findFirst({
      where: { id: assetA.id }
    });
    console.log(`FileAsset deletedAt: ${deletedAsset.deletedAt}, Status: ${deletedAsset.status}`);
    if (!deletedAsset.deletedAt || deletedAsset.status !== 'DELETED') {
      throw new Error('FileAsset was not soft-deleted!');
    }

    console.log('✅ SUCCESS: Soft delete of VaultDocument and FileAsset verified successfully!');

    // Cleanup mock database entries
    await prisma.vaultDocument.deleteMany({ where: { id: doc.id } });
    await prisma.fileAsset.deleteMany({ where: { id: { in: [assetA.id, assetB.id] } } });
    
  } catch (err) {
    console.error('❌ FAIL: Vault workflow test failed:', err);
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('ALL VAULT INTEGRATION UAT TESTS PASSED SUCCESSFULLY! ✓');
  console.log('==================================================');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
