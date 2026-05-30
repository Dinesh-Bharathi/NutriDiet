// scratch/test-settings.js
import { settingsService } from '../src/modules/settings/settings.service.js';
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('Testing localization caching...');
  const options = settingsService.getLocalizationOptions();
  console.log('Localization cache verified. Counts:');
  console.log('- Countries:', options.countries.length);
  console.log('- Currencies:', options.currencies.length);
  console.log('- Timezones:', options.timezones.length);
  console.log('- Locales:', options.locales.length);

  // Fetch first tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log('No tenants found in DB. Test complete.');
    return;
  }

  console.log(`\nTesting settings for tenant: ${tenant.name} (${tenant.id})`);
  const initialSettings = await settingsService.getTenantSettings(tenant.id);
  console.log('Initial Settings:', initialSettings);

  console.log('\nUpdating settings...');
  const updatedSettings = await settingsService.updateTenantSettings(tenant.id, {
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    currencyCode: 'INR',
    measurementSystem: 'METRIC',
  });
  console.log('Updated Settings:', updatedSettings);

  console.log('\nRestoring default settings...');
  const restoredSettings = await settingsService.updateTenantSettings(tenant.id, {
    countryCode: null,
    timezone: 'UTC',
    locale: 'en-US',
    currencyCode: 'USD',
    measurementSystem: 'METRIC',
  });
  console.log('Restored Settings:', restoredSettings);
}

main().catch(err => {
  console.error('Test failed:', err);
});
