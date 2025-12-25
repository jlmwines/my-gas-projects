const fs = require('fs');

const csvPath = './order_export_2025-12-16-complete.csv';

// Additional analysis

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => row[h] = values[idx] || '');
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

const content = fs.readFileSync(csvPath, 'utf-8');
const orders = parseCSV(content);

console.log(`\n=== ORDER DATA ANALYSIS ===\n`);
console.log(`Total orders: ${orders.length}`);

// Group by customer email
const customerOrders = {};
orders.forEach(order => {
  const email = order.customer_email?.toLowerCase();
  if (!email) return;
  if (!customerOrders[email]) customerOrders[email] = [];
  customerOrders[email].push(order);
});

const customerCount = Object.keys(customerOrders).length;
console.log(`Unique customers: ${customerCount}`);

// Order count distribution
const orderCounts = {};
Object.values(customerOrders).forEach(orders => {
  const count = orders.length;
  orderCounts[count] = (orderCounts[count] || 0) + 1;
});

console.log(`\n--- Order Count Distribution ---`);
Object.entries(orderCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([count, customers]) => {
  console.log(`  ${count} order(s): ${customers} customers (${((customers / customerCount) * 100).toFixed(1)}%)`);
});

// Days between orders for repeat customers
console.log(`\n--- Days Between Orders (Repeat Customers) ---`);
const daysBetween = [];
Object.values(customerOrders).forEach(orders => {
  if (orders.length < 2) return;
  const dates = orders.map(o => new Date(o.order_date)).sort((a, b) => a - b);
  for (let i = 1; i < dates.length; i++) {
    daysBetween.push(Math.round((dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24)));
  }
});

if (daysBetween.length > 0) {
  daysBetween.sort((a, b) => a - b);
  console.log(`  Intervals: ${daysBetween.length}`);
  console.log(`  Average: ${Math.round(daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length)} days`);
  console.log(`  Median: ${daysBetween[Math.floor(daysBetween.length / 2)]} days`);
  console.log(`  25th pct: ${daysBetween[Math.floor(daysBetween.length * 0.25)]} days`);
  console.log(`  75th pct: ${daysBetween[Math.floor(daysBetween.length * 0.75)]} days`);
  console.log(`  90th pct: ${daysBetween[Math.floor(daysBetween.length * 0.90)]} days`);
}

// Days since last order
console.log(`\n--- Days Since Last Order ---`);
const now = new Date();
const buckets = [[30,'0-30'], [60,'31-60'], [90,'61-90'], [180,'91-180'], [365,'181-365'], [730,'366-730'], [Infinity,'730+']];
const bucketCounts = buckets.map(() => ({ single: 0, repeat: 0 }));

Object.values(customerOrders).forEach(orders => {
  const lastOrder = new Date(Math.max(...orders.map(o => new Date(o.order_date))));
  const days = Math.round((now - lastOrder) / (1000 * 60 * 60 * 24));
  for (let i = 0; i < buckets.length; i++) {
    if (days <= buckets[i][0]) {
      if (orders.length === 1) bucketCounts[i].single++;
      else bucketCounts[i].repeat++;
      break;
    }
  }
});

console.log(`  Days Since Last  | Single | Repeat |`);
buckets.forEach((b, i) => {
  console.log(`  ${b[1].padEnd(15)} | ${String(bucketCounts[i].single).padStart(6)} | ${String(bucketCounts[i].repeat).padStart(6)} |`);
});

// Gift detection
console.log(`\n--- Gift vs Regular Orders ---`);
let giftOrders = 0;
orders.forEach(order => {
  const billingName = `${order.billing_first_name} ${order.billing_last_name}`.toLowerCase().trim();
  const shippingName = `${order.shipping_first_name} ${order.shipping_last_name}`.toLowerCase().trim();
  if (billingName !== shippingName || (order.billing_country !== 'IL' && order.shipping_country === 'IL')) giftOrders++;
});
console.log(`  Gift: ${giftOrders} (${((giftOrders/orders.length)*100).toFixed(1)}%)`);
console.log(`  Regular: ${orders.length - giftOrders} (${(((orders.length-giftOrders)/orders.length)*100).toFixed(1)}%)`);

// Coupon usage
console.log(`\n--- Coupon Usage ---`);
let withCoupon = 0;
orders.forEach(o => { if (o.coupon_items?.trim()) withCoupon++; });
console.log(`  Orders with coupons: ${withCoupon} (${((withCoupon/orders.length)*100).toFixed(1)}%)`);

// Language
console.log(`\n--- Language ---`);
const langs = {};
orders.forEach(o => { const l = o['meta:wpml_language'] || '?'; langs[l] = (langs[l]||0)+1; });
Object.entries(langs).forEach(([l,c]) => console.log(`  ${l}: ${c} (${((c/orders.length)*100).toFixed(1)}%)`));

// Monthly trends
console.log(`\n--- Monthly Orders ---`);
const monthly = {};
orders.forEach(o => {
  const d = new Date(o.order_date);
  const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  monthly[k] = (monthly[k]||0)+1;
});
Object.entries(monthly).sort().forEach(([m,c]) => console.log(`  ${m}: ${c}`));

// Order values
console.log(`\n--- Order Values (ILS) ---`);
const vals = orders.map(o => parseFloat(o.order_total)||0).filter(v => v > 0).sort((a,b) => a-b);
console.log(`  Avg: ${Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)}`);
console.log(`  Median: ${Math.round(vals[Math.floor(vals.length/2)])}`);
console.log(`  Min: ${Math.round(vals[0])}, Max: ${Math.round(vals[vals.length-1])}`);

// === DEEPER ANALYSIS ===

// Coupon breakdown: free shipping vs discount
console.log(`\n--- Coupon Types ---`);
let freeShipOrders = 0;
let discountOrders = 0;
let bothOrders = 0;
let noCouponOrders = 0;
const discountCodes = {};

orders.forEach(o => {
  const coupons = o.coupon_items?.toLowerCase() || '';
  const hasFreeShip = coupons.includes('shipfree') || coupons.includes('freeship') || coupons.includes('free_ship');
  const hasDiscount = coupons && !hasFreeShip;

  if (hasFreeShip && coupons.replace(/code:shipfree[^;|]*/g, '').match(/code:/)) {
    bothOrders++;
  } else if (hasFreeShip) {
    freeShipOrders++;
  } else if (coupons) {
    discountOrders++;
    // Extract discount codes
    const matches = coupons.match(/code:([^|;]+)/g) || [];
    matches.forEach(m => {
      const code = m.replace('code:', '').trim();
      if (!code.includes('shipfree')) {
        discountCodes[code] = (discountCodes[code] || 0) + 1;
      }
    });
  } else {
    noCouponOrders++;
  }
});

console.log(`  Free shipping only: ${freeShipOrders} (${((freeShipOrders/orders.length)*100).toFixed(1)}%)`);
console.log(`  Discount coupons: ${discountOrders} (${((discountOrders/orders.length)*100).toFixed(1)}%)`);
console.log(`  Both: ${bothOrders} (${((bothOrders/orders.length)*100).toFixed(1)}%)`);
console.log(`  No coupon: ${noCouponOrders} (${((noCouponOrders/orders.length)*100).toFixed(1)}%)`);
console.log(`  Top discount codes:`);
Object.entries(discountCodes).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([c,n]) => console.log(`    ${c}: ${n}`));

// Year over year comparison
console.log(`\n--- Year Over Year ---`);
const years = {2023: [], 2024: [], 2025: []};
orders.forEach(o => {
  const d = new Date(o.order_date);
  const y = d.getFullYear();
  if (years[y]) years[y].push(o);
});

Object.entries(years).forEach(([year, yOrders]) => {
  if (yOrders.length === 0) return;

  const uniqueCustomers = new Set(yOrders.map(o => o.customer_email?.toLowerCase())).size;
  const avgValue = Math.round(yOrders.reduce((s,o) => s + (parseFloat(o.order_total)||0), 0) / yOrders.length);
  const enCount = yOrders.filter(o => o['meta:wpml_language'] === 'en').length;
  const heCount = yOrders.filter(o => o['meta:wpml_language'] === 'he').length;
  const giftCount = yOrders.filter(o => {
    const bn = `${o.billing_first_name} ${o.billing_last_name}`.toLowerCase();
    const sn = `${o.shipping_first_name} ${o.shipping_last_name}`.toLowerCase();
    return bn !== sn || (o.billing_country !== 'IL' && o.shipping_country === 'IL');
  }).length;
  const couponCount = yOrders.filter(o => o.coupon_items?.trim()).length;

  console.log(`\n  ${year}:`);
  console.log(`    Orders: ${yOrders.length}`);
  console.log(`    Unique customers: ${uniqueCustomers}`);
  console.log(`    Avg order value: ${avgValue} ILS`);
  console.log(`    English: ${enCount} (${((enCount/yOrders.length)*100).toFixed(0)}%), Hebrew: ${heCount} (${((heCount/yOrders.length)*100).toFixed(0)}%)`);
  console.log(`    Gift orders: ${giftCount} (${((giftCount/yOrders.length)*100).toFixed(0)}%)`);
  console.log(`    Used coupons: ${couponCount} (${((couponCount/yOrders.length)*100).toFixed(0)}%)`);
});

// Order size distribution by year
console.log(`\n--- Order Size Distribution by Year ---`);
const sizeBuckets = [[200,'<200'], [400,'200-400'], [600,'400-600'], [1000,'600-1000'], [Infinity,'1000+']];
Object.entries(years).forEach(([year, yOrders]) => {
  if (yOrders.length === 0) return;
  console.log(`  ${year}:`);
  sizeBuckets.forEach(([max, label]) => {
    const prev = sizeBuckets[sizeBuckets.indexOf(sizeBuckets.find(b => b[0] === max)) - 1]?.[0] || 0;
    const count = yOrders.filter(o => {
      const v = parseFloat(o.order_total) || 0;
      return v > prev && v <= max;
    }).length;
    console.log(`    ${label}: ${count} (${((count/yOrders.length)*100).toFixed(0)}%)`);
  });
});

// Repeat customer locations
console.log(`\n--- Repeat Customer Locations ---`);
const repeatCustomerLocations = {};
Object.entries(customerOrders).forEach(([email, orders]) => {
  if (orders.length < 2) return;
  const loc = orders[0].shipping_country || 'Unknown';
  repeatCustomerLocations[loc] = (repeatCustomerLocations[loc] || 0) + 1;
});
Object.entries(repeatCustomerLocations).sort((a,b) => b[1]-a[1]).forEach(([loc, count]) => {
  console.log(`  ${loc}: ${count}`);
});

// Repeat customer cities (Israel)
console.log(`\n--- Repeat Customer Cities (Israel) ---`);
const repeatCustomerCities = {};
Object.entries(customerOrders).forEach(([email, orders]) => {
  if (orders.length < 2) return;
  if (orders[0].shipping_country !== 'IL') return;
  const city = orders[0].shipping_city || 'Unknown';
  repeatCustomerCities[city] = (repeatCustomerCities[city] || 0) + 1;
});
Object.entries(repeatCustomerCities).sort((a,b) => b[1]-a[1]).slice(0,15).forEach(([city, count]) => {
  console.log(`  ${city}: ${count}`);
});

// New vs returning customers by year
console.log(`\n--- New vs Returning Customers by Year ---`);
const seenBefore = new Set();
Object.entries(years).forEach(([year, yOrders]) => {
  if (yOrders.length === 0) return;
  let newCust = 0, returning = 0;
  const yearEmails = new Set();

  yOrders.sort((a,b) => new Date(a.order_date) - new Date(b.order_date)).forEach(o => {
    const email = o.customer_email?.toLowerCase();
    if (!email || yearEmails.has(email)) return;
    yearEmails.add(email);
    if (seenBefore.has(email)) {
      returning++;
    } else {
      newCust++;
      seenBefore.add(email);
    }
  });

  console.log(`  ${year}: New ${newCust}, Returning ${returning} (${((returning/(newCust+returning))*100).toFixed(0)}% returning)`);
});

// First order to second order conversion
console.log(`\n--- First to Second Order Conversion ---`);
const firstOrderYear = {};
const convertedYear = {};
Object.entries(customerOrders).forEach(([email, orders]) => {
  const sorted = orders.sort((a,b) => new Date(a.order_date) - new Date(b.order_date));
  const firstYear = new Date(sorted[0].order_date).getFullYear();
  if (!firstOrderYear[firstYear]) firstOrderYear[firstYear] = 0;
  firstOrderYear[firstYear]++;

  if (orders.length >= 2) {
    if (!convertedYear[firstYear]) convertedYear[firstYear] = 0;
    convertedYear[firstYear]++;
  }
});
Object.keys(firstOrderYear).sort().forEach(year => {
  const first = firstOrderYear[year] || 0;
  const conv = convertedYear[year] || 0;
  if (first > 0) {
    console.log(`  First order in ${year}: ${first} customers, ${conv} converted (${((conv/first)*100).toFixed(0)}%)`);
  }
});

// === EXCLUDE WAR-RELATED COUPONS ===
console.log(`\n\n========== EXCLUDING WAR-RELATED ORDERS ==========`);
const warCoupons = ['efrat', 'roshtzurim', 'gushwarriors'];
const normalOrders = orders.filter(o => {
  const coupons = o.coupon_items?.toLowerCase() || '';
  return !warCoupons.some(wc => coupons.includes(wc));
});
console.log(`Total orders: ${orders.length}, After excluding war-related: ${normalOrders.length}`);

// Redo key stats with normal orders
const normalCustomerOrders = {};
normalOrders.forEach(order => {
  const email = order.customer_email?.toLowerCase();
  if (!email) return;
  if (!normalCustomerOrders[email]) normalCustomerOrders[email] = [];
  normalCustomerOrders[email].push(order);
});

const normalCustomerCount = Object.keys(normalCustomerOrders).length;
console.log(`Unique customers (normal): ${normalCustomerCount}`);

// Order count distribution (normal)
const normalOrderCounts = {};
Object.values(normalCustomerOrders).forEach(orders => {
  const count = orders.length;
  normalOrderCounts[count] = (normalOrderCounts[count] || 0) + 1;
});

const singleOrder = normalOrderCounts[1] || 0;
const repeatOrders = normalCustomerCount - singleOrder;
console.log(`Single-order: ${singleOrder} (${((singleOrder/normalCustomerCount)*100).toFixed(0)}%)`);
console.log(`Repeat: ${repeatOrders} (${((repeatOrders/normalCustomerCount)*100).toFixed(0)}%)`);

// Israeli cities for all customers
console.log(`\n--- All Customer Cities (Israel, Normal Orders) ---`);
const allCustomerCities = {};
Object.entries(normalCustomerOrders).forEach(([email, orders]) => {
  if (orders[0].shipping_country !== 'IL') return;
  const city = (orders[0].shipping_city || 'Unknown').trim();
  allCustomerCities[city] = (allCustomerCities[city] || 0) + 1;
});
Object.entries(allCustomerCities).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([city, count]) => {
  console.log(`  ${city}: ${count}`);
});

// Repeat customers by city (normal)
console.log(`\n--- Repeat Customer Cities (Israel, Normal Orders) ---`);
const normalRepeatCities = {};
Object.entries(normalCustomerOrders).forEach(([email, orders]) => {
  if (orders.length < 2) return;
  if (orders[0].shipping_country !== 'IL') return;
  const city = (orders[0].shipping_city || 'Unknown').trim();
  normalRepeatCities[city] = (normalRepeatCities[city] || 0) + 1;
});
Object.entries(normalRepeatCities).sort((a,b) => b[1]-a[1]).slice(0,15).forEach(([city, count]) => {
  console.log(`  ${city}: ${count}`);
});

// === MAILCHIMP ANALYSIS ===
console.log(`\n\n========== MAILCHIMP AUDIENCE ANALYSIS ==========`);
const mailchimpPath = './subscribed_email_audience_export_e6074aaf6f.csv';
const mcContent = fs.readFileSync(mailchimpPath, 'utf-8');
const mcRows = parseCSV(mcContent);
console.log(`Total Mailchimp subscribers: ${mcRows.length}`);

// Language distribution
const mcLangs = {};
mcRows.forEach(r => {
  const lang = r.Language || 'Unknown';
  mcLangs[lang] = (mcLangs[lang] || 0) + 1;
});
console.log(`\n--- Mailchimp Language ---`);
Object.entries(mcLangs).sort((a,b) => b[1]-a[1]).forEach(([l,c]) => console.log(`  ${l}: ${c}`));

// Subscription date distribution
console.log(`\n--- Subscription Year ---`);
const mcYears = {};
mcRows.forEach(r => {
  const date = r.OPTIN_TIME || r.CONFIRM_TIME;
  if (!date) return;
  const year = new Date(date).getFullYear();
  if (year > 2000) mcYears[year] = (mcYears[year] || 0) + 1;
});
Object.entries(mcYears).sort((a,b) => a[0]-b[0]).forEach(([y,c]) => console.log(`  ${y}: ${c}`));

// Cross-reference: subscribers who are customers
console.log(`\n--- Mailchimp vs Orders Overlap ---`);
const mcEmails = new Set(mcRows.map(r => r['Email Address']?.toLowerCase()));
const orderEmails = new Set(Object.keys(normalCustomerOrders));

let subscribersWhoOrdered = 0;
let subscribersNoOrder = 0;
let customersNotSubscribed = 0;

mcEmails.forEach(email => {
  if (orderEmails.has(email)) subscribersWhoOrdered++;
  else subscribersNoOrder++;
});
orderEmails.forEach(email => {
  if (!mcEmails.has(email)) customersNotSubscribed++;
});

console.log(`  Subscribers who ordered: ${subscribersWhoOrdered}`);
console.log(`  Subscribers never ordered: ${subscribersNoOrder}`);
console.log(`  Customers not subscribed: ${customersNotSubscribed}`);

// Subscribers who never ordered - how long subscribed?
console.log(`\n--- Non-Customer Subscribers by Subscription Age ---`);
const nonCustomerSubs = mcRows.filter(r => {
  const email = r['Email Address']?.toLowerCase();
  return !orderEmails.has(email);
});

const subAgeBuckets = [[30,'<30 days'], [90,'30-90 days'], [180,'90-180 days'], [365,'180-365 days'], [730,'1-2 years'], [Infinity,'2+ years']];
const subAgeCounts = subAgeBuckets.map(() => 0);
const now2 = new Date();

nonCustomerSubs.forEach(r => {
  const date = r.OPTIN_TIME || r.CONFIRM_TIME;
  if (!date) return;
  const subDate = new Date(date);
  const days = Math.round((now2 - subDate) / (1000 * 60 * 60 * 24));
  for (let i = 0; i < subAgeBuckets.length; i++) {
    if (days <= subAgeBuckets[i][0]) {
      subAgeCounts[i]++;
      break;
    }
  }
});

subAgeBuckets.forEach((b, i) => {
  console.log(`  ${b[1]}: ${subAgeCounts[i]}`);
});

// === CORE CUSTOMERS ANALYSIS ===
// Core = not gift, not war-related
console.log(`\n\n========== CORE CUSTOMERS (NOT GIFT, NOT WAR) ==========`);
const coreOrders = normalOrders.filter(o => {
  const bn = `${o.billing_first_name} ${o.billing_last_name}`.toLowerCase().trim();
  const sn = `${o.shipping_first_name} ${o.shipping_last_name}`.toLowerCase().trim();
  const isGift = (bn !== sn) || (o.billing_country !== 'IL' && o.shipping_country === 'IL');
  return !isGift;
});

console.log(`Core orders: ${coreOrders.length} (of ${normalOrders.length} normal orders)`);

const coreCustomerOrders = {};
coreOrders.forEach(order => {
  const email = order.customer_email?.toLowerCase();
  if (!email) return;
  if (!coreCustomerOrders[email]) coreCustomerOrders[email] = [];
  coreCustomerOrders[email].push(order);
});

const coreCustomerCount = Object.keys(coreCustomerOrders).length;
const coreSingle = Object.values(coreCustomerOrders).filter(o => o.length === 1).length;
const coreRepeat = coreCustomerCount - coreSingle;

console.log(`Core customers: ${coreCustomerCount}`);
console.log(`  Single-order: ${coreSingle} (${((coreSingle/coreCustomerCount)*100).toFixed(0)}%)`);
console.log(`  Repeat: ${coreRepeat} (${((coreRepeat/coreCustomerCount)*100).toFixed(0)}%)`);

// Core customers by year
console.log(`\n--- Core Customers by Year ---`);
const coreYears = {2022: [], 2023: [], 2024: [], 2025: []};
coreOrders.forEach(o => {
  const d = new Date(o.order_date);
  const y = d.getFullYear();
  if (coreYears[y]) coreYears[y].push(o);
});

Object.entries(coreYears).forEach(([year, yOrders]) => {
  if (yOrders.length === 0) return;
  const uniqueCustomers = new Set(yOrders.map(o => o.customer_email?.toLowerCase())).size;
  const avgValue = Math.round(yOrders.reduce((s,o) => s + (parseFloat(o.order_total)||0), 0) / yOrders.length);
  const enCount = yOrders.filter(o => o['meta:wpml_language'] === 'en').length;
  const heCount = yOrders.filter(o => o['meta:wpml_language'] === 'he').length;

  console.log(`  ${year}: ${yOrders.length} orders, ${uniqueCustomers} customers, avg ${avgValue} ILS, EN ${((enCount/yOrders.length)*100).toFixed(0)}% HE ${((heCount/yOrders.length)*100).toFixed(0)}%`);
});

// Core customer language comparison: all vs repeat
console.log(`\n--- Core Customer Language: All vs Repeat ---`);
const allCoreLangs = {en: 0, he: 0, other: 0};
const repeatCoreLangs = {en: 0, he: 0, other: 0};

Object.entries(coreCustomerOrders).forEach(([email, orders]) => {
  const lang = orders[0]['meta:wpml_language'];
  const bucket = lang === 'en' ? 'en' : lang === 'he' ? 'he' : 'other';
  allCoreLangs[bucket]++;
  if (orders.length >= 2) repeatCoreLangs[bucket]++;
});

console.log(`  All core customers:`);
console.log(`    English: ${allCoreLangs.en} (${((allCoreLangs.en/coreCustomerCount)*100).toFixed(0)}%)`);
console.log(`    Hebrew: ${allCoreLangs.he} (${((allCoreLangs.he/coreCustomerCount)*100).toFixed(0)}%)`);
console.log(`    Other: ${allCoreLangs.other} (${((allCoreLangs.other/coreCustomerCount)*100).toFixed(0)}%)`);
console.log(`  Repeat core customers:`);
console.log(`    English: ${repeatCoreLangs.en} (${((repeatCoreLangs.en/coreRepeat)*100).toFixed(0)}%)`);
console.log(`    Hebrew: ${repeatCoreLangs.he} (${((repeatCoreLangs.he/coreRepeat)*100).toFixed(0)}%)`);
console.log(`    Other: ${repeatCoreLangs.other} (${((repeatCoreLangs.other/coreRepeat)*100).toFixed(0)}%)`);

// Core customer locations: all vs repeat
console.log(`\n--- Core Customer Cities: All vs Repeat ---`);
const allCoreCities = {};
const repeatCoreCities = {};

Object.entries(coreCustomerOrders).forEach(([email, orders]) => {
  const city = (orders[0].shipping_city || 'Unknown').trim();
  allCoreCities[city] = (allCoreCities[city] || 0) + 1;
  if (orders.length >= 2) {
    repeatCoreCities[city] = (repeatCoreCities[city] || 0) + 1;
  }
});

// Normalize city names
const normCity = (c) => {
  const map = {
    'ירושלים': 'Jerusalem', 'תל אביב': 'Tel Aviv', 'Tel Aviv-Yafo': 'Tel Aviv',
    'רעננה': "Ra'anana", 'Raanana': "Ra'anana", "Ra'anana": "Ra'anana",
    'רמת גן': 'Ramat Gan', 'חיפה': 'Haifa', 'אפרת': 'Efrat',
    'נתניה': 'Netanya', 'אשדוד': 'Ashdod', 'Bet Shemesh': 'Beit Shemesh',
    'בית שמש': 'Beit Shemesh', 'מודיעין': 'Modiin', 'הרצליה': 'Herzliya'
  };
  return map[c] || c;
};

const allNorm = {};
const repeatNorm = {};
Object.entries(allCoreCities).forEach(([c, n]) => {
  const norm = normCity(c);
  allNorm[norm] = (allNorm[norm] || 0) + n;
});
Object.entries(repeatCoreCities).forEach(([c, n]) => {
  const norm = normCity(c);
  repeatNorm[norm] = (repeatNorm[norm] || 0) + n;
});

console.log(`  City              | All  | Repeat | Repeat% |`);
Object.entries(allNorm).sort((a,b) => b[1]-a[1]).slice(0,15).forEach(([city, all]) => {
  const rep = repeatNorm[city] || 0;
  const pct = all > 0 ? ((rep/all)*100).toFixed(0) : 0;
  console.log(`  ${city.padEnd(17)} | ${String(all).padStart(4)} | ${String(rep).padStart(6)} | ${String(pct).padStart(6)}% |`);
});

// Order value: all vs repeat core customers
console.log(`\n--- Core Customer Order Values: All vs Repeat ---`);
const allCoreValues = [];
const repeatCoreValues = [];
const singleCoreValues = [];

Object.entries(coreCustomerOrders).forEach(([email, orders]) => {
  orders.forEach(o => {
    const val = parseFloat(o.order_total) || 0;
    allCoreValues.push(val);
    if (orders.length >= 2) repeatCoreValues.push(val);
    else singleCoreValues.push(val);
  });
});

allCoreValues.sort((a,b) => a-b);
repeatCoreValues.sort((a,b) => a-b);
singleCoreValues.sort((a,b) => a-b);

const median = arr => arr.length ? arr[Math.floor(arr.length/2)] : 0;
const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

console.log(`  All core orders: avg ${avg(allCoreValues)} ILS, median ${Math.round(median(allCoreValues))} ILS`);
console.log(`  Repeat customer orders: avg ${avg(repeatCoreValues)} ILS, median ${Math.round(median(repeatCoreValues))} ILS`);
console.log(`  Single customer orders: avg ${avg(singleCoreValues)} ILS, median ${Math.round(median(singleCoreValues))} ILS`);

// Days between orders for core repeat customers
console.log(`\n--- Core Repeat Customer Order Frequency ---`);
const coreDaysBetween = [];
Object.values(coreCustomerOrders).forEach(orders => {
  if (orders.length < 2) return;
  const dates = orders.map(o => new Date(o.order_date)).sort((a, b) => a - b);
  for (let i = 1; i < dates.length; i++) {
    coreDaysBetween.push(Math.round((dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24)));
  }
});

if (coreDaysBetween.length > 0) {
  coreDaysBetween.sort((a, b) => a - b);
  console.log(`  Intervals: ${coreDaysBetween.length}`);
  console.log(`  Average: ${Math.round(coreDaysBetween.reduce((a, b) => a + b, 0) / coreDaysBetween.length)} days`);
  console.log(`  Median: ${coreDaysBetween[Math.floor(coreDaysBetween.length / 2)]} days`);
  console.log(`  25th pct: ${coreDaysBetween[Math.floor(coreDaysBetween.length * 0.25)]} days`);
  console.log(`  75th pct: ${coreDaysBetween[Math.floor(coreDaysBetween.length * 0.75)]} days`);
}

// Conversion rate by year for core customers
console.log(`\n--- Core Customer Conversion by First Order Year ---`);
const coreFirstYear = {};
const coreConvertedYear = {};
Object.entries(coreCustomerOrders).forEach(([email, orders]) => {
  const sorted = orders.sort((a,b) => new Date(a.order_date) - new Date(b.order_date));
  const firstYear = new Date(sorted[0].order_date).getFullYear();
  if (firstYear < 2022) return;
  coreFirstYear[firstYear] = (coreFirstYear[firstYear] || 0) + 1;
  if (orders.length >= 2) {
    coreConvertedYear[firstYear] = (coreConvertedYear[firstYear] || 0) + 1;
  }
});

Object.keys(coreFirstYear).sort().forEach(year => {
  const first = coreFirstYear[year] || 0;
  const conv = coreConvertedYear[year] || 0;
  console.log(`  ${year}: ${first} new core customers, ${conv} converted to repeat (${((conv/first)*100).toFixed(0)}%)`);
});

// Days since last order for core customers
console.log(`\n--- Core Customer Recency ---`);
const now3 = new Date();
const coreRecency = {single: {}, repeat: {}};
const recencyBuckets = [[30,'Active (0-30)'], [90,'Recent (31-90)'], [180,'Cooling (91-180)'], [365,'Lapsed (181-365)'], [Infinity,'Dormant (365+)']];

Object.entries(coreCustomerOrders).forEach(([email, orders]) => {
  const lastOrder = new Date(Math.max(...orders.map(o => new Date(o.order_date))));
  const days = Math.round((now3 - lastOrder) / (1000 * 60 * 60 * 24));
  const type = orders.length >= 2 ? 'repeat' : 'single';

  for (let i = 0; i < recencyBuckets.length; i++) {
    if (days <= recencyBuckets[i][0]) {
      coreRecency[type][recencyBuckets[i][1]] = (coreRecency[type][recencyBuckets[i][1]] || 0) + 1;
      break;
    }
  }
});

console.log(`  Status            | Single | Repeat |`);
recencyBuckets.forEach(([max, label]) => {
  const s = coreRecency.single[label] || 0;
  const r = coreRecency.repeat[label] || 0;
  console.log(`  ${label.padEnd(18)} | ${String(s).padStart(6)} | ${String(r).padStart(6)} |`);
});

// === MAILCHIMP + CORE CUSTOMER CORRELATION ===
console.log(`\n\n========== MAILCHIMP + CORE CUSTOMER CORRELATION ==========`);

const coreEmails = new Set(Object.keys(coreCustomerOrders));
const coreRepeatEmails = new Set(Object.entries(coreCustomerOrders).filter(([e, o]) => o.length >= 2).map(([e]) => e));

// Mailchimp subscribers who are core customers
const mcCoreCustomers = mcRows.filter(r => coreEmails.has(r['Email Address']?.toLowerCase()));
const mcCoreRepeat = mcRows.filter(r => coreRepeatEmails.has(r['Email Address']?.toLowerCase()));
const mcNonCore = mcRows.filter(r => !coreEmails.has(r['Email Address']?.toLowerCase()));

console.log(`Mailchimp subscribers: ${mcRows.length}`);
console.log(`  Core customers: ${mcCoreCustomers.length} (${((mcCoreCustomers.length/mcRows.length)*100).toFixed(0)}%)`);
console.log(`  Core repeat customers: ${mcCoreRepeat.length}`);
console.log(`  Not core customers: ${mcNonCore.length}`);

// Core customers not in Mailchimp
const coreNotInMC = [...coreEmails].filter(e => !mcEmails.has(e));
console.log(`\nCore customers NOT in Mailchimp: ${coreNotInMC.length} of ${coreEmails.size} (${((coreNotInMC.length/coreEmails.size)*100).toFixed(0)}%)`);

// MEMBER_RATING analysis
console.log(`\n--- Mailchimp Member Rating (Engagement) ---`);
const ratingGroups = {all: {}, core: {}, coreRepeat: {}, nonCore: {}};

mcRows.forEach(r => {
  const rating = r.MEMBER_RATING || '?';
  const email = r['Email Address']?.toLowerCase();
  ratingGroups.all[rating] = (ratingGroups.all[rating] || 0) + 1;

  if (coreRepeatEmails.has(email)) {
    ratingGroups.coreRepeat[rating] = (ratingGroups.coreRepeat[rating] || 0) + 1;
  } else if (coreEmails.has(email)) {
    ratingGroups.core[rating] = (ratingGroups.core[rating] || 0) + 1;
  } else {
    ratingGroups.nonCore[rating] = (ratingGroups.nonCore[rating] || 0) + 1;
  }
});

console.log(`  Rating | All Subs | Core Single | Core Repeat | Non-Customer |`);
['1', '2', '3', '4', '5'].forEach(r => {
  const all = ratingGroups.all[r] || 0;
  const coreSingle = ratingGroups.core[r] || 0;
  const coreRep = ratingGroups.coreRepeat[r] || 0;
  const nonCore = ratingGroups.nonCore[r] || 0;
  console.log(`       ${r} | ${String(all).padStart(8)} | ${String(coreSingle).padStart(11)} | ${String(coreRep).padStart(11)} | ${String(nonCore).padStart(12)} |`);
});

// Average rating by group
const avgRating = (rows) => {
  const valid = rows.filter(r => r.MEMBER_RATING && !isNaN(parseInt(r.MEMBER_RATING)));
  if (valid.length === 0) return 0;
  return (valid.reduce((s, r) => s + parseInt(r.MEMBER_RATING), 0) / valid.length).toFixed(2);
};

console.log(`\n  Average rating:`);
console.log(`    All subscribers: ${avgRating(mcRows)}`);
console.log(`    Core customers: ${avgRating(mcCoreCustomers)}`);
console.log(`    Core repeat: ${avgRating(mcCoreRepeat)}`);
console.log(`    Non-customers: ${avgRating(mcNonCore)}`);

// Did subscribers who became customers subscribe before or after first order?
console.log(`\n--- Subscription Timing vs First Order ---`);
let subBeforeOrder = 0;
let subAfterOrder = 0;
let subSameDay = 0;

mcCoreCustomers.forEach(mc => {
  const email = mc['Email Address']?.toLowerCase();
  const subDate = new Date(mc.OPTIN_TIME || mc.CONFIRM_TIME);
  const orders = coreCustomerOrders[email];
  if (!orders || !orders.length) return;

  const firstOrderDate = new Date(Math.min(...orders.map(o => new Date(o.order_date))));
  const diffDays = Math.round((firstOrderDate - subDate) / (1000 * 60 * 60 * 24));

  if (diffDays > 1) subBeforeOrder++;
  else if (diffDays < -1) subAfterOrder++;
  else subSameDay++;
});

console.log(`  Subscribed before first order: ${subBeforeOrder}`);
console.log(`  Subscribed same day as order: ${subSameDay}`);
console.log(`  Subscribed after first order: ${subAfterOrder}`);

// Non-customer subscribers by rating - conversion potential
console.log(`\n--- Non-Customer Subscribers: Conversion Potential ---`);
console.log(`  High engagement (rating 4-5): ${(ratingGroups.nonCore['4']||0) + (ratingGroups.nonCore['5']||0)} prospects`);
console.log(`  Medium engagement (rating 3): ${ratingGroups.nonCore['3']||0} prospects`);
console.log(`  Low engagement (rating 1-2): ${(ratingGroups.nonCore['1']||0) + (ratingGroups.nonCore['2']||0)} prospects`);

// High engagement non-customers by subscription age
console.log(`\n--- High Engagement Non-Customers by Sub Age ---`);
const highEngageNonCust = mcNonCore.filter(r => parseInt(r.MEMBER_RATING) >= 4);
const heAgeBuckets = [[90,'<90 days'], [180,'90-180 days'], [365,'180-365 days'], [Infinity,'365+ days']];
const heAgeCounts = heAgeBuckets.map(() => 0);

highEngageNonCust.forEach(r => {
  const subDate = new Date(r.OPTIN_TIME || r.CONFIRM_TIME);
  const days = Math.round((now3 - subDate) / (1000 * 60 * 60 * 24));
  for (let i = 0; i < heAgeBuckets.length; i++) {
    if (days <= heAgeBuckets[i][0]) {
      heAgeCounts[i]++;
      break;
    }
  }
});

heAgeBuckets.forEach((b, i) => {
  console.log(`  ${b[1]}: ${heAgeCounts[i]}`);
});