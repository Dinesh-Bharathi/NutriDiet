// src/modules/settings/settings.service.js
import { createRequire } from 'module';
import prisma from '../../lib/prisma.js';
import ApiError from '../../utils/ApiError.js';
import { getCountryCallingCode, getExampleNumber } from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';

const require = createRequire(import.meta.url);
const countries = require('i18n-iso-countries');
const enLocale = require('i18n-iso-countries/langs/en.json');
countries.registerLocale(enLocale);

const currencyCodes = require('currency-codes');
const countriesAndTimezones = require('countries-and-timezones');

const SUPPORTED_LOCALES = [
  { code: 'en-US', name: 'English (United States)' },
  { code: 'en-GB', name: 'English (United Kingdom)' },
  { code: 'en-IN', name: 'English (India)' },
  { code: 'es-ES', name: 'Español (España)' },
  { code: 'es-MX', name: 'Español (México)' },
  { code: 'fr-FR', name: 'Français (France)' },
  { code: 'de-DE', name: 'Deutsch (Deutschland)' },
  { code: 'it-IT', name: 'Italiano (Italia)' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
];

let cachedLocalizationOptions = null;

function ensureLocalizationCache() {
  if (cachedLocalizationOptions) return;

  // 1. Countries
  const countryObj = countries.getNames('en', { select: 'official' });
  const countriesList = [];
  
  for (const [code, name] of Object.entries(countryObj)) {
    let dialCode = '';
    let phoneExample = '';
    try {
      dialCode = `+${getCountryCallingCode(code)}`;
      const example = getExampleNumber(code, examples);
      if (example) {
        phoneExample = example.formatNational();
      }
    } catch (err) {
      // Ignore country codes not supported by libphonenumber-js
    }
    
    countriesList.push({
      code,
      name,
      dialCode,
      phoneExample,
    });
  }

  // 2. Currencies
  const currenciesList = currencyCodes.data.map((item) => ({
    code: item.code,
    name: item.currency,
  }));

  // 3. Timezones
  const timezonesList = Object.values(countriesAndTimezones.getAllTimezones()).map((tz) => ({
    name: tz.name,
    utcOffset: tz.utcOffset,
    utcOffsetStr: tz.utcOffsetStr,
  }));

  cachedLocalizationOptions = {
    countries: countriesList.sort((a, b) => a.name.localeCompare(b.name)),
    currencies: currenciesList.sort((a, b) => a.code.localeCompare(b.code)),
    timezones: timezonesList.sort((a, b) => a.name.localeCompare(b.name)),
    locales: SUPPORTED_LOCALES,
  };
}

export const settingsService = {
  /**
   * Retrieves static localization options (countries, timezones, locales, currencies)
   * served from memory cache.
   */
  getLocalizationOptions() {
    ensureLocalizationCache();
    return cachedLocalizationOptions;
  },

  /**
   * Fetches settings for a specific tenant.
   *
   * @param {string} tenantId
   */
  async getTenantSettings(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        logoUrl: true,
        countryCode: true,
        timezone: true,
        locale: true,
        currencyCode: true,
        measurementSystem: true,
        practiceEmail: true,
        practicePhone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        updatedAt: true,
      },
    });

    if (!tenant) {
      throw ApiError.notFound('Tenant');
    }

    return tenant;
  },

  /**
   * Updates settings for a specific tenant.
   *
   * @param {string} tenantId
   * @param {object} data
   */
  async updateTenantSettings(tenantId, data) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw ApiError.notFound('Tenant');
    }

    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        countryCode: data.countryCode,
        timezone: data.timezone,
        locale: data.locale,
        currencyCode: data.currencyCode,
        measurementSystem: data.measurementSystem,
        practiceEmail: data.practiceEmail,
        practicePhone: data.practicePhone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
      },
      select: {
        name: true,
        logoUrl: true,
        countryCode: true,
        timezone: true,
        locale: true,
        currencyCode: true,
        measurementSystem: true,
        practiceEmail: true,
        practicePhone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        updatedAt: true,
      },
    });
  },

  /**
   * Fetches PDF template settings for a specific tenant.
   *
   * @param {string} tenantId
   */
  async getPdfTemplateConfig(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        pdfTemplateConfig: true,
      },
    });

    if (!tenant) {
      throw ApiError.notFound('Tenant');
    }

    return tenant.pdfTemplateConfig;
  },

  /**
   * Updates PDF template settings for a specific tenant.
   *
   * @param {string} tenantId
   * @param {object} data
   */
  async updatePdfTemplateConfig(tenantId, data) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw ApiError.notFound('Tenant');
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        pdfTemplateConfig: data,
      },
      select: {
        pdfTemplateConfig: true,
      },
    });

    return updatedTenant.pdfTemplateConfig;
  },
};
