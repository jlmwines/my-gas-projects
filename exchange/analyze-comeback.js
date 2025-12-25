const fs = require('fs');
const csv = fs.readFileSync('comeback-targets.csv', 'utf8');
const lines = csv.trim().split('\n');
const headers = lines[0].split(',');

const data = lines.slice(1).map(line => {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  const obj = {};
  headers.forEach((h, i) => obj[h.trim()] = values[i] || '');
  return obj;
});

// Stats
const stats = {
  total: data.length,
  byCustomerType: {},
  byLifecycle: {},
  byLanguage: {},
  subscribed: 0,
  notSubscribed: 0,
  totalSpend: 0,
  avgSpend: 0,
  byBundleMatch: {}
};

data.forEach(d => {
  // Customer type
  stats.byCustomerType[d.customerType] = (stats.byCustomerType[d.customerType] || 0) + 1;
  // Lifecycle
  stats.byLifecycle[d.lifecycleStatus] = (stats.byLifecycle[d.lifecycleStatus] || 0) + 1;
  // Language (normalize)
  let lang = (d.language || '').toLowerCase();
  if (lang === 'en') lang = 'english';
  stats.byLanguage[lang] = (stats.byLanguage[lang] || 0) + 1;
  // Subscribed
  if (d.isSubscribed === 'true') stats.subscribed++;
  else stats.notSubscribed++;
  // Total spend
  stats.totalSpend += parseFloat(d.totalSpend) || 0;
  // Bundle matches
  (d.bundleMatches || '').split(',').map(b => b.trim()).filter(b => b).forEach(b => {
    stats.byBundleMatch[b] = (stats.byBundleMatch[b] || 0) + 1;
  });
});

stats.avgSpend = Math.round(stats.totalSpend / data.length);
stats.totalSpend = Math.round(stats.totalSpend);

// Top spenders
const topSpenders = [...data].sort((a,b) => parseFloat(b.totalSpend) - parseFloat(a.totalSpend)).slice(0,10);

// Days since order distribution
const daysBuckets = { '181-365': 0, '366-730': 0, '731+': 0 };
data.forEach(d => {
  const days = parseInt(d.daysSinceOrder) || 0;
  if (days <= 365) daysBuckets['181-365']++;
  else if (days <= 730) daysBuckets['366-730']++;
  else daysBuckets['731+']++;
});

// VIPs analysis
const vips = data.filter(d => d.customerType === 'core.vip');
const vipSpend = vips.reduce((sum, d) => sum + (parseFloat(d.totalSpend) || 0), 0);

console.log('=== COMEBACK SEGMENT ANALYSIS ===\n');
console.log('Total contacts:', stats.total);
console.log('\nBy Customer Type:');
Object.entries(stats.byCustomerType).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));
console.log('\nBy Lifecycle Status:');
Object.entries(stats.byLifecycle).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));
console.log('\nBy Days Since Order:');
Object.entries(daysBuckets).forEach(([k,v]) => console.log('  ' + k + ' days: ' + v));
console.log('\nBy Language:');
Object.entries(stats.byLanguage).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));
console.log('\nSubscription Status:');
console.log('  Subscribed:', stats.subscribed);
console.log('  Not Subscribed:', stats.notSubscribed);
console.log('\nSpending:');
console.log('  Total historical spend: NIS ' + stats.totalSpend.toLocaleString());
console.log('  Average per customer: NIS ' + stats.avgSpend.toLocaleString());
console.log('\nVIP Segment:');
console.log('  Count:', vips.length);
console.log('  Total VIP spend: NIS ' + Math.round(vipSpend).toLocaleString());
console.log('  Avg VIP spend: NIS ' + Math.round(vipSpend / vips.length).toLocaleString());
console.log('\nBundle Match Distribution:');
Object.entries(stats.byBundleMatch).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));
console.log('\nTop 10 by Historical Spend:');
topSpenders.forEach((c,i) => console.log('  ' + (i+1) + '. ' + c.name + ' - NIS ' + Math.round(parseFloat(c.totalSpend)).toLocaleString() + ' (' + c.customerType + ', ' + c.language + ')'));
