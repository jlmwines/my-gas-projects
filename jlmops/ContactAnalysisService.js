/**
 * @file ContactAnalysisService.js
 * @description Provides actionable insights from contact and activity data.
 */

const ContactAnalysisService = (function() {
  const SERVICE_NAME = 'ContactAnalysisService';

  // Keywords that indicate delivery instructions (NOT a gift)
  const DELIVERY_KEYWORDS = ['please', 'deliver', 'call', 'phone', 'outside', 'floor', 'door', 'gate', 'code', 'buzzer', 'entrance', 'building', 'apartment', 'apt'];

  /**
   * Determines if an order is a gift based on addresses and customer note.
   * Uses inverse logic - identifies delivery instructions to exclude non-gifts.
   * @param {Object} order - Order with billingCity, shippingCity, customerNote
   * @returns {boolean} True if order appears to be a gift
   */
  function isGiftOrder(order) {
    const note = (order.customerNote || '').toLowerCase();
    const billingCity = (order.billingCity || '').trim();
    const shippingCity = (order.shippingCity || '').trim();

    // Same city = not a gift
    if (billingCity && shippingCity && billingCity.toLowerCase() === shippingCity.toLowerCase()) {
      return false;
    }

    // No note but different addresses = likely gift
    if (!note && billingCity !== shippingCity) {
      return true;
    }

    // Delivery instructions = not a gift
    for (const keyword of DELIVERY_KEYWORDS) {
      if (note.includes(keyword)) {
        return false;
      }
    }

    // Everything else with different addresses = gift
    return billingCity !== shippingCity;
  }

  /**
   * Extracts unique shipping cities from order history.
   * Used to seed the SysLkp_Cities lookup table.
   * Calculates language tendency from contact data.
   * @returns {Object} City analysis with counts
   */
  function extractUniqueCities() {
    const fnName = 'extractUniqueCities';
    LoggerService.info(SERVICE_NAME, fnName, 'Extracting unique cities from orders');

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const spreadsheet = SheetAccessor.getDataSpreadsheet();

    // city -> { count, billingCount, shippingCount, hebrewContacts, englishContacts }
    const cityData = new Map();

    // Build contact language lookup from SysContacts
    const contactLanguage = _buildContactLanguageLookup(spreadsheet, sheetNames);

    // Process current orders
    const currentSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    if (currentSheet) {
      _processCitiesFromSheet(currentSheet, 'wom_', cityData, contactLanguage);
    }

    // Process archive orders
    const archiveSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM_Archive);
    if (archiveSheet) {
      _processCitiesFromSheet(archiveSheet, 'woma_', cityData, contactLanguage);
    }

    // Convert to sorted array
    const cities = [];
    for (const [city, data] of cityData) {
      // Count unique core customers by language
      const hebrewCount = data.hebrewCustomers ? data.hebrewCustomers.size : 0;
      const englishCount = data.englishCustomers ? data.englishCustomers.size : 0;

      cities.push({
        city: city,
        totalOrders: data.count,
        asShipping: data.shippingCount,
        asBilling: data.billingCount,
        isIsraeli: _looksIsraeli(city),
        hasHebrew: /[\u0590-\u05FF]/.test(city),
        hebrewCustomers: hebrewCount,
        englishCustomers: englishCount,
        totalCoreCustomers: hebrewCount + englishCount
      });
    }

    // Sort by total orders descending
    cities.sort((a, b) => b.totalOrders - a.totalOrders);

    LoggerService.info(SERVICE_NAME, fnName, `Found ${cities.length} unique cities`);

    return {
      totalCities: cities.length,
      israeliCities: cities.filter(c => c.isIsraeli).length,
      foreignCities: cities.filter(c => !c.isIsraeli).length,
      hebrewCities: cities.filter(c => c.hasHebrew).length,
      cities: cities
    };
  }

  /**
   * Builds a lookup of email -> language from SysContacts.
   */
  function _buildContactLanguageLookup(spreadsheet, sheetNames) {
    const lookup = new Map();
    const sheet = spreadsheet.getSheetByName(sheetNames.SysContacts || 'SysContacts');
    if (!sheet) return lookup;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return lookup;

    const headers = data[0];
    const emailCol = headers.indexOf('sc_Email');
    const langCol = headers.indexOf('sc_Language');

    if (emailCol === -1) return lookup;

    for (let i = 1; i < data.length; i++) {
      const email = String(data[i][emailCol] || '').toLowerCase().trim();
      const lang = String(data[i][langCol] || '').toLowerCase().trim();
      if (email) {
        lookup.set(email, lang === 'he' ? 'he' : 'en');
      }
    }

    return lookup;
  }

  /**
   * Processes cities from an order sheet.
   * Tracks unique core customers per city for language analysis.
   */
  function _processCitiesFromSheet(sheet, prefix, cityData, contactLanguage) {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const headers = data[0];
    const colMap = {};
    headers.forEach((h, i) => colMap[h] = i);

    const billingCityCol = colMap[prefix + 'BillingCity'];
    const shippingCityCol = colMap[prefix + 'ShippingCity'];
    const emailCol = colMap[prefix + 'BillingEmail'];
    const noteCol = colMap[prefix + 'CustomerNote'];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const email = String(row[emailCol] || '').toLowerCase().trim();
      const contactLang = contactLanguage.get(email) || 'en';
      const billingCity = _normalizeRawCity(row[billingCityCol]);
      const shippingCity = _normalizeRawCity(row[shippingCityCol]);
      const customerNote = String(row[noteCol] || '');

      // Check if this is a gift order (not a core customer order)
      const isGift = isGiftOrder({
        billingCity: billingCity,
        shippingCity: shippingCity,
        customerNote: customerNote
      });

      // Process billing city (order count only)
      if (billingCity) {
        if (!cityData.has(billingCity)) {
          cityData.set(billingCity, {
            count: 0, billingCount: 0, shippingCount: 0,
            hebrewCustomers: new Set(), englishCustomers: new Set()
          });
        }
        const d = cityData.get(billingCity);
        d.count++;
        d.billingCount++;
      }

      // Process shipping city
      if (shippingCity) {
        if (!cityData.has(shippingCity)) {
          cityData.set(shippingCity, {
            count: 0, billingCount: 0, shippingCount: 0,
            hebrewCustomers: new Set(), englishCustomers: new Set()
          });
        }
        const d = cityData.get(shippingCity);
        d.count++;
        d.shippingCount++;

        // Track unique core customers by language (not gift recipients)
        if (!isGift && email) {
          if (contactLang === 'he') {
            d.hebrewCustomers.add(email);
          } else {
            d.englishCustomers.add(email);
          }
        }
      }
    }
  }

  /**
   * Basic normalization of raw city input.
   */
  function _normalizeRawCity(raw) {
    if (!raw) return '';
    return String(raw).trim();
  }

  /**
   * Heuristic to detect if a city looks Israeli.
   * Uses common patterns and Hebrew characters.
   */
  function _looksIsraeli(city) {
    if (!city) return false;
    const lower = city.toLowerCase();

    // Hebrew characters = Israeli
    if (/[\u0590-\u05FF]/.test(city)) return true;

    // Common Israeli city patterns
    const israeliPatterns = [
      'jerusalem', 'tel aviv', 'tel-aviv', 'haifa', 'beer sheva', 'beersheva',
      'netanya', 'ashdod', 'ashkelon', 'eilat', 'herzliya', 'raanana', "ra'anana",
      'modiin', "modi'in", 'petah tikva', 'rishon', 'rehovot', 'kfar', 'kibbutz',
      'moshav', 'efrat', 'beit shemesh', 'bet shemesh', 'givat', 'ramat', 'neve',
      'maale', "ma'ale", 'gush', 'ariel', 'dimona', 'arad', 'yavne', 'lod',
      'ramla', 'holon', 'bat yam', 'bnei brak', 'givatayim', 'nazareth', 'akko',
      'nahariya', 'tiberias', 'safed', 'tzfat', 'carmiel', 'yokneam', 'afula'
    ];

    for (const pattern of israeliPatterns) {
      if (lower.includes(pattern)) return true;
    }

    return false;
  }

  /**
   * Generates a CSV-ready output of cities for manual categorization.
   * @returns {string} CSV content
   */
  function generateCitySeedCSV() {
    const result = extractUniqueCities();
    const lines = ['City,TotalOrders,AsShipping,AsBilling,IsIsraeli,HasHebrew,Code,Type,Region,LanguageTend,WineAccess'];

    for (const city of result.cities) {
      // Only include cities with at least 2 orders and appear Israeli
      if (city.totalOrders >= 2 && city.isIsraeli) {
        lines.push([
          `"${city.city.replace(/"/g, '""')}"`,
          city.totalOrders,
          city.asShipping,
          city.asBilling,
          city.isIsraeli,
          city.hasHebrew,
          '', // Code - to be filled
          '', // Type - to be filled
          '', // Region - to be filled
          '', // LanguageTend - to be filled
          ''  // WineAccess - to be filled
        ].join(','));
      }
    }

    return lines.join('\n');
  }

  /**
   * Writes extracted cities directly to SysLkp_Cities sheet.
   * @returns {Object} Result with count
   */
  function writeCitiesToSheet() {
    const fnName = 'writeCitiesToSheet';
    LoggerService.info(SERVICE_NAME, fnName, 'Extracting and writing cities to sheet');

    const result = extractUniqueCities();

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const spreadsheet = SheetAccessor.getDataSpreadsheet();

    const sheet = spreadsheet.getSheetByName(sheetNames.SysLkp_Cities || 'SysLkp_Cities');
    if (!sheet) {
      throw new Error('SysLkp_Cities sheet not found. Run createSysLkpCitiesHeaders() first.');
    }

    // Filter to Israeli cities with 2+ orders
    const citiesToWrite = result.cities.filter(c => c.totalOrders >= 2 && c.isIsraeli);

    if (citiesToWrite.length === 0) {
      LoggerService.info(SERVICE_NAME, fnName, 'No cities to write');
      return { written: 0 };
    }

    // Build rows: slc_Code, slc_NameEN, slc_NameHE, slc_Aliases, slc_Type, slc_Region, slc_LanguageTend, slc_WineAccess
    const rows = citiesToWrite.map(city => {
      // Use city name as temporary code (uppercase, no spaces)
      const tempCode = city.city.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_').toUpperCase().substring(0, 20);

      // If Hebrew, put in NameHE, otherwise NameEN
      const nameEN = city.hasHebrew ? '' : city.city;
      const nameHE = city.hasHebrew ? city.city : '';

      // Show unique core customers by language: "he:12/en:3"
      const langSplit = `he:${city.hebrewCustomers}/en:${city.englishCustomers}`;

      return [
        tempCode,           // slc_Code (temporary - to be cleaned up)
        nameEN,             // slc_NameEN
        nameHE,             // slc_NameHE
        '',                 // slc_Aliases
        '',                 // slc_Type (to be filled manually)
        '',                 // slc_Region (to be filled manually)
        langSplit,          // slc_LanguageTend (he:X/en:Y from order data)
        ''                  // slc_WineAccess (to be filled manually)
      ];
    });

    // Write starting at row 2 (after headers)
    sheet.getRange(2, 1, rows.length, 8).setValues(rows);

    LoggerService.info(SERVICE_NAME, fnName, `Wrote ${rows.length} cities to SysLkp_Cities`);
    return { written: rows.length, total: result.totalCities };
  }

  /**
   * Checks for new cities that passed the threshold and aren't in the lookup.
   * Auto-adds them and creates a task to categorize.
   * Called from HousekeepingService.
   * @param {number} threshold - Minimum orders to qualify (default 2)
   * @returns {Object} Result with new cities added
   */
  function maintainCityLookup(threshold = 2) {
    const fnName = 'maintainCityLookup';
    LoggerService.info(SERVICE_NAME, fnName, 'Checking for new cities to add');

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const spreadsheet = SheetAccessor.getDataSpreadsheet();

    // Get existing cities from lookup
    const lookupSheet = spreadsheet.getSheetByName(sheetNames.SysLkp_Cities || 'SysLkp_Cities');
    if (!lookupSheet) {
      LoggerService.warn(SERVICE_NAME, fnName, 'SysLkp_Cities sheet not found');
      return { added: 0, error: 'Sheet not found' };
    }

    const existingCities = new Set();
    const lookupData = lookupSheet.getDataRange().getValues();
    for (let i = 1; i < lookupData.length; i++) {
      const code = String(lookupData[i][0] || '').trim();
      const nameEN = String(lookupData[i][1] || '').trim().toLowerCase();
      const nameHE = String(lookupData[i][2] || '').trim();
      if (code) existingCities.add(code);
      if (nameEN) existingCities.add(nameEN);
      if (nameHE) existingCities.add(nameHE);
    }

    // Extract all cities from orders
    const cityAnalysis = extractUniqueCities();

    // Find new Israeli cities that pass threshold and aren't in lookup
    const newCities = cityAnalysis.cities.filter(city => {
      if (!city.isIsraeli) return false;
      if (city.totalOrders < threshold) return false;

      const cityLower = city.city.toLowerCase();
      const tempCode = city.city.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_').toUpperCase().substring(0, 20);

      return !existingCities.has(cityLower) &&
             !existingCities.has(city.city) &&
             !existingCities.has(tempCode);
    });

    if (newCities.length === 0) {
      LoggerService.info(SERVICE_NAME, fnName, 'No new cities to add');
      return { added: 0 };
    }

    // Add new cities to lookup
    const rows = newCities.map(city => {
      const tempCode = city.city.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_').toUpperCase().substring(0, 20);
      const nameEN = city.hasHebrew ? '' : city.city;
      const nameHE = city.hasHebrew ? city.city : '';
      const langSplit = `he:${city.hebrewCustomers}/en:${city.englishCustomers}`;

      return [tempCode, nameEN, nameHE, '', '', '', langSplit, ''];
    });

    const lastRow = lookupSheet.getLastRow();
    lookupSheet.getRange(lastRow + 1, 1, rows.length, 8).setValues(rows);

    LoggerService.info(SERVICE_NAME, fnName, `Added ${rows.length} new cities`);

    // Create task to categorize new cities
    if (typeof TaskService !== 'undefined') {
      const cityNames = newCities.map(c => c.city).join(', ');
      TaskService.createTask(
        'task.data.review',
        null,
        'System',
        `Categorize ${newCities.length} new cities`,
        `New cities added to SysLkp_Cities need Type, Region, and WineAccess: ${cityNames}`,
        null
      );
      LoggerService.info(SERVICE_NAME, fnName, 'Created task to categorize new cities');
    }

    return { added: rows.length, cities: newCities.map(c => c.city) };
  }

  // Public API
  return {
    isGiftOrder: isGiftOrder,
    extractUniqueCities: extractUniqueCities,
    generateCitySeedCSV: generateCitySeedCSV,
    writeCitiesToSheet: writeCitiesToSheet,
    maintainCityLookup: maintainCityLookup
  };
})();

/**
 * Global function to extract unique cities from order data.
 * Run from Apps Script UI to generate seed data for SysLkp_Cities.
 */
function extractOrderCities() {
  return ContactAnalysisService.extractUniqueCities();
}

/**
 * Global function to generate CSV for city categorization.
 * Output can be pasted into a sheet for manual enrichment.
 */
function generateCitySeedData() {
  const csv = ContactAnalysisService.generateCitySeedCSV();
  Logger.log(csv);
  return csv;
}

/**
 * Global function to write cities directly to SysLkp_Cities sheet.
 * Run createSysLkpCitiesHeaders() first to create the sheet.
 */
function writeCitiesToSheet() {
  return ContactAnalysisService.writeCitiesToSheet();
}

/**
 * Global function to check for and add new cities.
 * Called from HousekeepingService or manually.
 */
function maintainCityLookup() {
  return ContactAnalysisService.maintainCityLookup();
}
