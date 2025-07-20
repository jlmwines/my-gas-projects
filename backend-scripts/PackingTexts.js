/**
 * Reads product data from the "PackingRows" sheet, formats specific
 * details into a descriptive paragraph, and outputs them to "PackingText".
 */
function generatePackingTextDetails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const packingRowsSheet = ss.getSheetByName("PackingRows");
  // IMPORTANT: Changed 'const' to 'let' here to allow re-assignment if the sheet is created
  let packingTextSheet = ss.getSheetByName("PackingText");

  // Basic error handling if source sheet is missing
  if (!packingRowsSheet) {
    Logger.log("Error: 'PackingRows' sheet not found.");
    SpreadsheetApp.getUi().alert("Error: 'PackingRows' sheet not found. Please ensure this sheet exists and is populated by 'populatePackingData()'.");
    return;
  }

  // Create 'PackingText' sheet if it doesn't exist
  if (!packingTextSheet) {
    packingTextSheet = ss.insertSheet("PackingText");
    Logger.log("Created new sheet: 'PackingText'.");
  }

  // Clear existing contents in PackingText (from row 1, as headers will be re-added)
  packingTextSheet.clearContents();
  Logger.log("Cleared existing content in 'PackingText' sheet.");

  const rowsData = packingRowsSheet.getDataRange().getValues();
  if (rowsData.length <= 1) { // Only headers or no data rows
    Logger.log("No product data found in 'PackingRows' sheet to process. Only headers will be written to 'PackingText'.");
    // Write just the headers if no data
    const emptyHeaders = ["Order Number", "SKU", "Product Description"];
    packingTextSheet.getRange(1, 1, 1, emptyHeaders.length).setValues([emptyHeaders]);
    SpreadsheetApp.getUi().alert("No product details available to format. Check 'PackingRows' sheet.");
    return;
  }

  const headers = rowsData[0];
  const productRows = rowsData.slice(1); // Skip header row for processing

  // --- Define Column Indices for PackingRows (0-indexed) ---
  // Using indexOf for robustness, but ensure your headers are exact matches!
  const colNameEN = headers.indexOf("Name EN");
  const colShort = headers.indexOf("Short");
  const colIntensity = headers.indexOf("Intensity");
  const colComplexity = headers.indexOf("Complexity");
  const colAcidity = headers.indexOf("Acidity");
  const colHarmonize = headers.indexOf("Harmonize");
  const colContrast = headers.indexOf("Contrast");
  const colDecant = headers.indexOf("Decant");
  const colOrderNumber = headers.indexOf("Order Number"); // For context in PackingText
  const colSKU = headers.indexOf("SKU");                   // For context in PackingText

  // Validate critical columns are found
  if (colNameEN === -1 || colOrderNumber === -1 || colSKU === -1) {
    Logger.log("Error: One or more required columns (Name EN, Order Number, SKU) not found in 'PackingRows'.");
    SpreadsheetApp.getUi().alert("Error: Missing critical columns in 'PackingRows'. Please check headers.");
    return;
  }

  const textOutput = [];
  // Headers for the PackingText sheet
  const textOutputHeaders = ["Order Number", "SKU", "Product Description"];
  textOutput.push(textOutputHeaders);

  productRows.forEach(row => {
    // Safely retrieve values, defaulting to empty string if column doesn't exist or value is null/undefined
    const orderNumber = row[colOrderNumber] || "";
    const sku = row[colSKU] || "";
    const nameEN = row[colNameEN] || "";
    const short = row[colShort] || "";
    const intensity = row[colIntensity] || "";
    const complexity = row[colComplexity] || "";
    const acidity = row[colAcidity] || "";
    const harmonize = row[colHarmonize] || "";
    const contrast = row[colContrast] || "";
    const decant = row[colDecant] || "";

    const paragraphLines = [];

    // Line 1: Product Name (always included if available)
    if (String(nameEN).trim() !== "") {
      paragraphLines.push(String(nameEN).trim());
    }

    // Line 2: Short description (if available and not empty)
    if (String(short).trim() !== "") {
      paragraphLines.push(String(short).trim());
    }

    // Line 3: Intensity, Complexity, Acidity (concatenated if available, as scales 1-5)
    const qualities = [];
    // Ensure values are numbers before formatting, even if stored as strings
    const numIntensity = Number(intensity);
    const numComplexity = Number(complexity);
    const numAcidity = Number(acidity);

    // Apply the "Label (1-5): Value" format
    if (!isNaN(numIntensity) && numIntensity >=1 && numIntensity <=5) qualities.push(`Intensity (1-5): ${numIntensity}`);
    if (!isNaN(numComplexity) && numComplexity >=1 && numComplexity <=5) qualities.push(`Complexity (1-5): ${numComplexity}`);
    if (!isNaN(numAcidity) && numAcidity >=1 && numAcidity <=5) qualities.push(`Acidity (1-5): ${numAcidity}`);

    if (qualities.length > 0) {
      paragraphLines.push(qualities.join(", "));
    }

    // Line 4: Harmonize (formatted phrase, if available and not empty)
    if (String(harmonize).trim() !== "") {
      paragraphLines.push(`Harmonize with ${String(harmonize).trim()} flavors.`);
    }

    // Line 5: Contrast (formatted phrase, if available and not empty)
    if (String(contrast).trim() !== "") {
      paragraphLines.push(`Contrast with ${String(contrast).trim()} flavors.`);
    }

    // Final Line: Decant (formatted phrase, if available and not empty)
    if (String(decant).trim() !== "") {
      paragraphLines.push(`We recommend decanting for ${String(decant).trim()} minutes before serving.`);
    }

    // Join all collected lines with a newline character to form the paragraph
    const formattedDescription = paragraphLines.join("\n");

    // Add the formatted description along with Order Number and SKU for context
    textOutput.push([orderNumber, sku, formattedDescription]);
  });

  if (textOutput.length > 1) { // Check if there's more than just headers to write
    packingTextSheet.getRange(1, 1, textOutput.length, textOutput[0].length).setValues(textOutput);
    Logger.log(`SUCCESS: Generated ${textOutput.length - 1} product descriptions in 'PackingText'.`);
    SpreadsheetApp.getUi().alert("Packing text details generated successfully!");
  } else {
    // If only headers, just write headers (already done above, but safe check)
    Logger.log("No product descriptions generated (only headers written to 'PackingText').");
    // alert is already sent above if rowsData.length <= 1
  }
}