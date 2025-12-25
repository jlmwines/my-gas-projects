/**
 * Build complete activity data from source files.
 * Run with: node build-activity-data.js
 *
 * Outputs: activity_import.csv for direct import into SysContactActivity
 */

const fs = require('fs');
const path = require('path');

// CSV parsing helper (handles quoted fields with commas)
function parseCSV(content) {
  const lines = [];
  let currentLine = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentLine.push(currentField);
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentLine.push(currentField);
        if (currentLine.length > 1 || currentLine[0]) {
          lines.push(currentLine);
        }
        currentLine = [];
        currentField = '';
        if (char === '\r') i++; // skip \n after \r
      } else if (char !== '\r') {
        currentField += char;
      }
    }
  }

  // Last line
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField);
    lines.push(currentLine);
  }

  return lines;
}

// Convert array to object using headers
function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] || '';
  });
  return obj;
}

// Format date for sheets
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString();
  } catch (e) {
    return dateStr;
  }
}

// Escape CSV field
function escapeCSV(val) {
  const str = String(val || '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Main function
function buildActivityData() {
  console.log('Building activity data from local files...\n');

  const basePath = __dirname;

  // Read source files
  const ordersContent = fs.readFileSync(path.join(basePath, 'order_export_2025-12-16-complete.csv'), 'utf8');
  const subscribersContent = fs.readFileSync(path.join(basePath, 'subscribed_email_audience_export_e6074aaf6f.csv'), 'utf8');
  const campaignsContent = fs.readFileSync(path.join(basePath, 'mailchimp campaigns.csv'), 'utf8');

  // Parse CSVs
  const ordersRows = parseCSV(ordersContent);
  const subscribersRows = parseCSV(subscribersContent);
  const campaignsRows = parseCSV(campaignsContent);

  const orderHeaders = ordersRows[0];
  const subscriberHeaders = subscribersRows[0];
  const campaignHeaders = campaignsRows[0];

  console.log(`Loaded: ${ordersRows.length - 1} orders, ${subscribersRows.length - 1} subscribers, ${campaignsRows.length - 1} campaigns\n`);

  const activities = [];
  const stats = {
    orders: 0,
    coupons: 0,
    subscriptions: 0,
    campaigns: 0,
    skippedOrders: 0,
    skippedCoupons: 0
  };

  // ==========================================
  // 1. ORDER ACTIVITIES
  // ==========================================
  console.log('Processing orders...');

  for (let i = 1; i < ordersRows.length; i++) {
    const row = rowToObject(orderHeaders, ordersRows[i]);
    const orderId = row.order_id;
    const email = (row.billing_email || '').toLowerCase().trim();
    const orderDate = row.order_date;
    const status = (row.status || '').toLowerCase();
    const orderNumber = row.order_number || orderId;
    const orderTotal = row.order_total || '0';

    if (!email || !orderId) continue;

    // Only completed/processing orders
    if (status !== 'completed' && status !== 'processing') {
      stats.skippedOrders++;
      continue;
    }

    // Count items from line_item columns
    let itemCount = 0;
    for (let j = 1; j <= 24; j++) {
      const lineItem = row[`line_item_${j}`];
      if (lineItem) {
        // Parse quantity from "quantity:X"
        const qtyMatch = lineItem.match(/quantity:(\d+)/);
        if (qtyMatch) {
          itemCount += parseInt(qtyMatch[1], 10);
        }
      }
    }

    // Fallback: count Product Item columns
    if (itemCount === 0) {
      for (let j = 1; j <= 24; j++) {
        const qty = row[`Product Item ${j} Quantity`];
        if (qty) {
          itemCount += parseInt(qty, 10) || 0;
        }
      }
    }

    const activityId = `order.placed.${orderId}`;
    const summary = `Order #${orderNumber}: ${itemCount} items, ₪${Math.round(parseFloat(orderTotal))}`;
    const details = JSON.stringify({
      orderId: orderId,
      orderNumber: orderNumber,
      total: parseFloat(orderTotal),
      itemCount: itemCount
    });

    activities.push({
      sca_ActivityId: activityId,
      sca_Email: email,
      sca_Timestamp: formatDate(orderDate),
      sca_Type: 'order.placed',
      sca_Summary: summary,
      sca_Details: details,
      sca_CreatedBy: 'import'
    });

    stats.orders++;

    // ==========================================
    // 2. COUPON ACTIVITIES (from same order)
    // ==========================================
    const couponItems = row.coupon_items || '';
    if (couponItems) {
      // Format: "code:SHIPFREE|amount:0.00;code:WELCOME10|amount:44.03"
      const coupons = couponItems.split(';');
      for (const couponStr of coupons) {
        if (!couponStr.trim()) continue;

        const parts = couponStr.split('|');
        let code = '';
        let amount = 0;

        for (const part of parts) {
          const [key, val] = part.split(':');
          if (key === 'code') code = val;
          if (key === 'amount') amount = parseFloat(val) || 0;
        }

        if (!code) continue;

        // Skip shipping coupons
        const codeLower = code.toLowerCase();
        if (codeLower.includes('ship') || codeLower.includes('delivery') || codeLower.includes('free')) {
          stats.skippedCoupons++;
          continue;
        }

        const couponActivityId = `coupon.used.${orderId}.${code}`;
        activities.push({
          sca_ActivityId: couponActivityId,
          sca_Email: email,
          sca_Timestamp: formatDate(orderDate),
          sca_Type: 'coupon.used',
          sca_Summary: `Used coupon ${code} (-₪${amount})`,
          sca_Details: JSON.stringify({ code: code, discount: amount, orderId: orderId }),
          sca_CreatedBy: 'import'
        });

        stats.coupons++;
      }
    }
  }

  console.log(`  Orders: ${stats.orders} activities (${stats.skippedOrders} skipped non-completed)`);
  console.log(`  Coupons: ${stats.coupons} activities (${stats.skippedCoupons} skipped shipping coupons)\n`);

  // ==========================================
  // 3. SUBSCRIPTION ACTIVITIES
  // ==========================================
  console.log('Processing subscribers...');

  // Build subscriber map: email -> { subscribeDate, language }
  const subscriberMap = new Map();

  for (let i = 1; i < subscribersRows.length; i++) {
    const row = rowToObject(subscriberHeaders, subscribersRows[i]);
    const email = (row['Email Address'] || '').toLowerCase().trim();
    const subscribeDate = row['OPTIN_TIME'] || row['CONFIRM_TIME'];
    const language = (row['Language'] || 'English').toLowerCase();

    if (!email) continue;

    const lang = language.includes('hebrew') || language === 'he' ? 'he' : 'en';

    subscriberMap.set(email, {
      subscribeDate: subscribeDate,
      language: lang,
      firstName: row['First Name'] || '',
      lastName: row['Last Name'] || ''
    });

    const activityId = `subscription.started.${email}`;
    activities.push({
      sca_ActivityId: activityId,
      sca_Email: email,
      sca_Timestamp: formatDate(subscribeDate),
      sca_Type: 'subscription.started',
      sca_Summary: `Subscribed to newsletter`,
      sca_Details: JSON.stringify({ language: lang }),
      sca_CreatedBy: 'import'
    });

    stats.subscriptions++;
  }

  console.log(`  Subscriptions: ${stats.subscriptions} activities\n`);

  // ==========================================
  // 4. CAMPAIGN ACTIVITIES
  // ==========================================
  console.log('Processing campaigns...');

  // Parse campaigns
  const campaigns = [];
  const hebrewPattern = /[\u0590-\u05FF]/;

  for (let i = 1; i < campaignsRows.length; i++) {
    const row = rowToObject(campaignHeaders, campaignsRows[i]);
    const title = row['Title'] || '';
    const subject = row['Subject'] || '';
    const sendDate = row['Send Date'] || '';
    const uniqueId = row['Unique Id'] || `camp_${i}`;

    if (!sendDate) continue;

    // Detect language from title/subject
    const isHebrew = hebrewPattern.test(title) || hebrewPattern.test(subject);

    campaigns.push({
      id: uniqueId,
      title: title,
      subject: subject,
      sendDate: sendDate,
      language: isHebrew ? 'he' : 'en'
    });
  }

  console.log(`  Found ${campaigns.length} campaigns (${campaigns.filter(c => c.language === 'he').length} Hebrew, ${campaigns.filter(c => c.language === 'en').length} English)`);

  // For each subscriber, add campaign activities for campaigns sent after their subscribe date
  for (const [email, subscriber] of subscriberMap) {
    const subDate = new Date(subscriber.subscribeDate);
    if (isNaN(subDate.getTime())) continue;

    for (const campaign of campaigns) {
      // Parse campaign send date (format: "Jun 29, 2021 05:16 pm")
      const campDate = new Date(campaign.sendDate);
      if (isNaN(campDate.getTime())) continue;

      // Only include campaigns sent AFTER subscribe date
      if (campDate <= subDate) continue;

      // Only include campaigns matching subscriber language
      if (campaign.language !== subscriber.language) continue;

      const activityId = `campaign.received.${campaign.id}.${email}`;
      activities.push({
        sca_ActivityId: activityId,
        sca_Email: email,
        sca_Timestamp: campDate.toISOString(),
        sca_Type: 'campaign.received',
        sca_Summary: `Received: ${campaign.title}`,
        sca_Details: JSON.stringify({ campaignId: campaign.id, title: campaign.title, language: campaign.language }),
        sca_CreatedBy: 'import'
      });

      stats.campaigns++;
    }
  }

  console.log(`  Campaign activities: ${stats.campaigns}\n`);

  // ==========================================
  // 5. OUTPUT CSV
  // ==========================================
  console.log('Writing output...');

  // Sort by timestamp
  activities.sort((a, b) => {
    const dateA = new Date(a.sca_Timestamp);
    const dateB = new Date(b.sca_Timestamp);
    return dateA - dateB;
  });

  // Build CSV
  const headers = ['sca_ActivityId', 'sca_Email', 'sca_Timestamp', 'sca_Type', 'sca_Summary', 'sca_Details', 'sca_CreatedBy'];
  const lines = [headers.join(',')];

  for (const activity of activities) {
    const row = headers.map(h => escapeCSV(activity[h]));
    lines.push(row.join(','));
  }

  const outputPath = path.join(basePath, 'activity_import.csv');
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

  console.log(`\nOutput: ${outputPath}`);
  console.log(`Total activities: ${activities.length}`);
  console.log(`  - Orders: ${stats.orders}`);
  console.log(`  - Coupons: ${stats.coupons}`);
  console.log(`  - Subscriptions: ${stats.subscriptions}`);
  console.log(`  - Campaigns: ${stats.campaigns}`);

  // Also output summary by email for verification
  const byEmail = new Map();
  for (const activity of activities) {
    const email = activity.sca_Email;
    if (!byEmail.has(email)) {
      byEmail.set(email, { orders: 0, coupons: 0, subscriptions: 0, campaigns: 0 });
    }
    const counts = byEmail.get(email);
    if (activity.sca_Type === 'order.placed') counts.orders++;
    if (activity.sca_Type === 'coupon.used') counts.coupons++;
    if (activity.sca_Type === 'subscription.started') counts.subscriptions++;
    if (activity.sca_Type === 'campaign.received') counts.campaigns++;
  }

  // Sample output for verification
  console.log('\nSample contacts (first 10 with orders):');
  let shown = 0;
  for (const [email, counts] of byEmail) {
    if (counts.orders > 0 && shown < 10) {
      console.log(`  ${email}: ${counts.orders} orders, ${counts.coupons} coupons, ${counts.subscriptions} subs, ${counts.campaigns} campaigns`);
      shown++;
    }
  }
}

buildActivityData();
