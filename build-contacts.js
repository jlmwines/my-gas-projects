/**
 * Build SysContacts CSV from order and subscriber data.
 * Usage: node build-contacts.js
 *
 * Input files:
 *   - order_export_2025-12-16-complete.csv
 *   - subscribed_email_audience_export_e6074aaf6f.csv
 *
 * Output: sys_contacts_import.csv
 *
 * CRITICAL: Uses billing_email (not customer_email) to match system behavior.
 * CRITICAL: Excludes only cancelled/refunded/failed orders to match system behavior.
 */

const fs = require('fs');
const path = require('path');

// CSV parser (handles quoted fields)
function parseCSV(content) {
  const lines = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else if (char === '\r') {
      // skip CR
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  // Parse each line into fields
  return lines.map(line => {
    const fields = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(field);
        field = '';
      } else {
        field += char;
      }
    }
    fields.push(field);
    return fields;
  });
}

// Format phone for WhatsApp (normalize to international format)
function formatPhoneForWhatsApp(phone) {
  if (!phone) return '';
  // Remove leading apostrophe if present (Excel formatting)
  let cleaned = phone.replace(/^'/, '');
  // Remove non-digits except leading +
  let digits = cleaned.replace(/[^\d+]/g, '');
  if (!digits) return '';

  // If starts with +, keep as is
  if (digits.startsWith('+')) {
    return digits;
  }

  // Handle Israeli numbers
  if (digits.startsWith('0') && digits.length === 10) {
    return '+972' + digits.substring(1);
  }
  if (digits.startsWith('972')) {
    return '+' + digits;
  }
  // Handle US numbers
  if (digits.length === 10) {
    return '+1' + digits;
  }
  if (digits.startsWith('1') && digits.length === 11) {
    return '+' + digits;
  }
  // Return with + prefix
  return '+' + digits;
}

// Normalize language code
function normalizeLanguage(lang) {
  if (!lang) return '';
  const lower = lang.toLowerCase();
  if (lower === 'hebrew' || lower === 'he') return 'he';
  if (lower === 'english' || lower === 'en') return 'en';
  return lower.substring(0, 2);
}

// Format date as YYYY-MM-DD
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

// Main
const orderFile = path.join(__dirname, 'order_export_2025-12-16-complete.csv');
const subscriberFile = path.join(__dirname, 'subscribed_email_audience_export_e6074aaf6f.csv');
const outputFile = path.join(__dirname, 'sys_contacts_import.csv');

console.log('Loading order data...');
const orderContent = fs.readFileSync(orderFile, 'utf8');
const orderRows = parseCSV(orderContent);
const orderHeaders = orderRows.shift();

// Map header names to indices
const orderIdx = {};
orderHeaders.forEach((h, i) => orderIdx[h] = i);

// Verify required columns exist
const requiredOrderCols = ['billing_email', 'status', 'order_date', 'order_total',
  'billing_first_name', 'billing_last_name', 'billing_phone', 'billing_city', 'billing_country'];
for (const col of requiredOrderCols) {
  if (orderIdx[col] === undefined) {
    console.error(`ERROR: Required column '${col}' not found in order CSV`);
    process.exit(1);
  }
}

// Status counts for verification
const statusCounts = {};
const excludedStatuses = ['cancelled', 'refunded', 'failed'];

// Aggregate orders by email
const contactsByEmail = new Map();

let totalOrders = 0;
let includedOrders = 0;
let excludedOrders = 0;

for (const row of orderRows) {
  totalOrders++;
  const status = (row[orderIdx['status']] || '').toLowerCase().trim();

  // Track status distribution
  statusCounts[status || '(empty)'] = (statusCounts[status || '(empty)'] || 0) + 1;

  // Match system filter: exclude only cancelled, refunded, failed
  if (excludedStatuses.includes(status)) {
    excludedOrders++;
    continue;
  }

  // Use billing_email (matches system's wom_BillingEmail)
  const email = (row[orderIdx['billing_email']] || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    continue;
  }

  includedOrders++;

  const orderDate = row[orderIdx['order_date']];
  const orderTotal = parseFloat(row[orderIdx['order_total']]) || 0;
  const firstName = row[orderIdx['billing_first_name']] || '';
  const lastName = row[orderIdx['billing_last_name']] || '';
  const phone = row[orderIdx['billing_phone']] || '';
  const city = row[orderIdx['billing_city']] || '';
  const country = row[orderIdx['billing_country']] || '';
  const language = orderIdx['meta:wpml_language'] !== undefined ? row[orderIdx['meta:wpml_language']] || '' : '';

  if (!contactsByEmail.has(email)) {
    contactsByEmail.set(email, {
      email,
      firstName,
      lastName,
      phone,
      city,
      country,
      language,
      orders: [],
      isSubscribed: false,
      subscribedDate: '',
      subscriptionSource: ''
    });
  }

  const contact = contactsByEmail.get(email);
  contact.orders.push({ date: orderDate, total: orderTotal });

  // Update contact info if better data available
  if (!contact.firstName && firstName) contact.firstName = firstName;
  if (!contact.lastName && lastName) contact.lastName = lastName;
  if (!contact.phone && phone) contact.phone = phone;
  if (!contact.city && city) contact.city = city;
  if (!contact.country && country) contact.country = country;
  if (!contact.language && language) contact.language = language;
}

console.log(`\nOrder processing results:`);
console.log(`  Total orders in CSV: ${totalOrders}`);
console.log(`  Included orders: ${includedOrders}`);
console.log(`  Excluded orders: ${excludedOrders}`);
console.log(`  Unique customers from orders: ${contactsByEmail.size}`);
console.log(`\nStatus distribution:`);
Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
  const excluded = excludedStatuses.includes(status) ? ' (EXCLUDED)' : '';
  console.log(`  ${status}: ${count}${excluded}`);
});

// Load subscriber data
console.log('\nLoading subscriber data...');
const subscriberContent = fs.readFileSync(subscriberFile, 'utf8');
const subscriberRows = parseCSV(subscriberContent);
const subscriberHeaders = subscriberRows.shift();

const subIdx = {};
subscriberHeaders.forEach((h, i) => subIdx[h] = i);

let newSubscribers = 0;
let matchedSubscribers = 0;
let subscriberTotal = 0;

for (const row of subscriberRows) {
  subscriberTotal++;
  const email = (row[subIdx['Email Address']] || '').toLowerCase().trim();
  if (!email || !email.includes('@')) continue;

  const firstName = row[subIdx['First Name']] || '';
  const lastName = row[subIdx['Last Name']] || '';
  const phone = row[subIdx['Phone Number']] || '';
  const language = row[subIdx['Language']] || '';
  const optinTime = row[subIdx['OPTIN_TIME']] || '';

  if (contactsByEmail.has(email)) {
    // Existing customer - mark as subscribed
    const contact = contactsByEmail.get(email);
    contact.isSubscribed = true;
    contact.subscribedDate = optinTime;
    contact.subscriptionSource = 'mailchimp';

    // Fill in missing data from subscriber info
    if (!contact.firstName && firstName) contact.firstName = firstName;
    if (!contact.lastName && lastName) contact.lastName = lastName;
    if (!contact.phone && phone) contact.phone = phone;
    if (!contact.language && language) contact.language = normalizeLanguage(language);

    matchedSubscribers++;
  } else {
    // New subscriber (non-customer)
    contactsByEmail.set(email, {
      email,
      firstName,
      lastName,
      phone,
      city: '',
      country: '',
      language: normalizeLanguage(language),
      orders: [],
      isSubscribed: true,
      subscribedDate: optinTime,
      subscriptionSource: 'mailchimp'
    });
    newSubscribers++;
  }
}

console.log(`\nSubscriber processing results:`);
console.log(`  Total subscribers in CSV: ${subscriberTotal}`);
console.log(`  Matched to existing customers: ${matchedSubscribers}`);
console.log(`  New subscriber-only contacts: ${newSubscribers}`);
console.log(`  Total contacts: ${contactsByEmail.size}`);

// Build output CSV
const sysContactsHeaders = [
  'sc_Email', 'sc_Name', 'sc_Phone', 'sc_WhatsAppPhone', 'sc_Language',
  'sc_City', 'sc_Country', 'sc_CustomerType', 'sc_LifecycleStatus',
  'sc_IsCore', 'sc_IsCustomer', 'sc_IsSubscribed', 'sc_FirstOrderDate',
  'sc_LastOrderDate', 'sc_DaysSinceOrder', 'sc_OrderCount', 'sc_TotalSpend',
  'sc_AvgOrderValue', 'sc_SubscribedDate', 'sc_DaysSubscribed',
  'sc_SubscriptionSource', 'sc_LastContactDate', 'sc_LastContactType',
  'sc_NextOrderExpected', 'sc_ChurnRisk', 'sc_FrequentCategories',
  'sc_PriceAvg', 'sc_PriceMin', 'sc_PriceMax', 'sc_RedIntensityRange',
  'sc_RedComplexityRange', 'sc_WhiteComplexityRange', 'sc_WhiteAcidityRange',
  'sc_TopWineries', 'sc_TopRedGrapes', 'sc_TopWhiteGrapes', 'sc_KashrutPrefs',
  'sc_BundleBuyer', 'sc_AvgBottlesPerOrder', 'sc_Tags', 'sc_Notes',
  'sc_CreatedDate', 'sc_LastUpdated', 'sc_LastEnriched'
];

const now = new Date().toISOString().split('T')[0];
const outputRows = [];

let customerCount = 0;
let subscriberCount = 0;

for (const [email, contact] of contactsByEmail) {
  // Calculate order metrics
  const orderDates = contact.orders.map(o => new Date(o.date)).filter(d => !isNaN(d.getTime()));
  const firstOrderDate = orderDates.length ? formatDate(new Date(Math.min(...orderDates))) : '';
  const lastOrderDate = orderDates.length ? formatDate(new Date(Math.max(...orderDates))) : '';
  const orderCount = contact.orders.length;
  const totalSpend = contact.orders.reduce((sum, o) => sum + o.total, 0);

  const isCustomer = orderCount > 0;
  if (isCustomer) customerCount++;
  if (contact.isSubscribed) subscriberCount++;

  // Build name as "Last, First" or just first/last if one is missing
  let name = '';
  if (contact.lastName && contact.firstName) {
    name = `${contact.lastName}, ${contact.firstName}`;
  } else if (contact.lastName) {
    name = contact.lastName;
  } else if (contact.firstName) {
    name = contact.firstName;
  }

  const row = [
    email,                                    // sc_Email
    name,                                     // sc_Name
    contact.phone,                            // sc_Phone
    formatPhoneForWhatsApp(contact.phone),    // sc_WhatsAppPhone
    contact.language || '',                   // sc_Language
    contact.city,                             // sc_City
    contact.country || 'IL',                  // sc_Country (default IL)
    '',                                       // sc_CustomerType (system calculates)
    '',                                       // sc_LifecycleStatus (system calculates)
    isCustomer ? 'TRUE' : 'FALSE',            // sc_IsCore (customers default TRUE, system can override)
    isCustomer ? 'TRUE' : 'FALSE',            // sc_IsCustomer
    contact.isSubscribed ? 'TRUE' : 'FALSE',  // sc_IsSubscribed
    firstOrderDate,                           // sc_FirstOrderDate
    lastOrderDate,                            // sc_LastOrderDate
    '',                                       // sc_DaysSinceOrder (system calculates)
    orderCount || '',                         // sc_OrderCount
    totalSpend ? Math.round(totalSpend) : '', // sc_TotalSpend (rounded)
    '',                                       // sc_AvgOrderValue (system calculates)
    formatDate(contact.subscribedDate),       // sc_SubscribedDate
    '',                                       // sc_DaysSubscribed (system calculates)
    contact.subscriptionSource,               // sc_SubscriptionSource
    '',                                       // sc_LastContactDate
    '',                                       // sc_LastContactType
    '',                                       // sc_NextOrderExpected (system calculates)
    '',                                       // sc_ChurnRisk (system calculates)
    '',                                       // sc_FrequentCategories (enrichment)
    '',                                       // sc_PriceAvg (enrichment)
    '',                                       // sc_PriceMin (enrichment)
    '',                                       // sc_PriceMax (enrichment)
    '',                                       // sc_RedIntensityRange (enrichment)
    '',                                       // sc_RedComplexityRange (enrichment)
    '',                                       // sc_WhiteComplexityRange (enrichment)
    '',                                       // sc_WhiteAcidityRange (enrichment)
    '',                                       // sc_TopWineries (enrichment)
    '',                                       // sc_TopRedGrapes (enrichment)
    '',                                       // sc_TopWhiteGrapes (enrichment)
    '',                                       // sc_KashrutPrefs (enrichment)
    '',                                       // sc_BundleBuyer (enrichment)
    '',                                       // sc_AvgBottlesPerOrder (enrichment)
    '',                                       // sc_Tags
    '',                                       // sc_Notes
    now,                                      // sc_CreatedDate
    now,                                      // sc_LastUpdated
    ''                                        // sc_LastEnriched
  ];

  outputRows.push(row);
}

// Sort by last order date (most recent first), then by subscribed date
outputRows.sort((a, b) => {
  const aLastOrder = a[13] || '';  // sc_LastOrderDate
  const bLastOrder = b[13] || '';
  if (aLastOrder && bLastOrder) return bLastOrder.localeCompare(aLastOrder);
  if (aLastOrder) return -1;
  if (bLastOrder) return 1;

  const aSubDate = a[18] || '';  // sc_SubscribedDate
  const bSubDate = b[18] || '';
  return bSubDate.localeCompare(aSubDate);
});

// Write CSV
function escapeCSV(val) {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const csvContent = [
  sysContactsHeaders.join(','),
  ...outputRows.map(row => row.map(escapeCSV).join(','))
].join('\n');

fs.writeFileSync(outputFile, csvContent, 'utf8');

console.log(`\n========================================`);
console.log(`OUTPUT SUMMARY`);
console.log(`========================================`);
console.log(`Output file: ${outputFile}`);
console.log(`Total contacts: ${outputRows.length}`);
console.log(`  Customers (IsCustomer=TRUE): ${customerCount}`);
console.log(`  Subscribers (IsSubscribed=TRUE): ${subscriberCount}`);
console.log(`  Both: ${matchedSubscribers}`);
console.log(`  Customer-only: ${customerCount - matchedSubscribers}`);
console.log(`  Subscriber-only: ${newSubscribers}`);
