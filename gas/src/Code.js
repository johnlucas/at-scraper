// Configuration
const API_URL = "https://at-scraper.onrender.com";
const SEARCHES_SHEET_NAME = "searches";
const RESULTS_SHEET_NAME = "results";

// Add menu when the spreadsheet opens
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("AutoTrader Scraper")
    .addItem("Run Scraper", "runScraper")
    .addToUi();
}

// Main function to run the scraper
function runScraper() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const searchesSheet = ss.getSheetByName(SEARCHES_SHEET_NAME);
  const resultsSheet = ss.getActiveSheet();

  // Check if we're on the searches sheet
  if (resultsSheet.getName() === SEARCHES_SHEET_NAME) {
    SpreadsheetApp.getUi().alert(
      "Please run this from the sheet where you want to append results, not from the searches sheet."
    );
    return;
  }

  // Get all searches
  const searches = getSearches(searchesSheet);
  if (!searches || searches.length === 0) {
    SpreadsheetApp.getUi().alert(
      "No active searches found in the searches sheet."
    );
    return;
  }

  // Process each active search
  let totalListings = 0;
  searches.forEach((search) => {
    if (search.status.toLowerCase() === "on") {
      const listings = fetchListings(search.url);
      if (listings && listings.length > 0) {
        appendListings(resultsSheet, listings, search.search_name);
        totalListings += listings.length;
      }
    }
  });

  SpreadsheetApp.getUi().alert(
    `Scraping completed! Added ${totalListings} listings.`
  );
}

// Get all searches from the searches sheet
function getSearches(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Find column indices
  const nameIndex = headers.indexOf("search_name");
  const urlIndex = headers.indexOf("url");
  const statusIndex = headers.indexOf("status");

  // Check if we have all required columns
  if (nameIndex === -1 || urlIndex === -1 || statusIndex === -1) {
    SpreadsheetApp.getUi().alert(
      "Required columns not found in searches sheet. Please ensure you have search_name, url, and status columns."
    );
    return null;
  }

  // Convert data to objects
  return data.slice(1).map((row) => ({
    search_name: row[nameIndex],
    url: row[urlIndex],
    status: row[statusIndex],
  }));
}

// Fetch listings from the API
function fetchListings(baseURL) {
  try {
    console.log(`Fetching listings for URL: ${baseURL}`);
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ baseURL }),
      muteHttpExceptions: true,
    };

    console.log("Making API request to:", `${API_URL}/debug-scrape`);
    const response = UrlFetchApp.fetch(`${API_URL}/debug-scrape`, options);
    console.log("Response status:", response.getResponseCode());
    const responseText = response.getContentText();
    console.log("Response body:", responseText);

    const json = JSON.parse(responseText);

    if (!json.success) {
      console.error("API Error:", json.error);
      return null;
    }

    console.log(`Found ${json.listings ? json.listings.length : 0} listings`);
    return json.listings;
  } catch (error) {
    console.error("Fetch Error:", error);
    console.error("Error stack:", error.stack);
    return null;
  }
}

// Append listings to the results sheet
function appendListings(sheet, listings, searchName) {
  if (!listings || listings.length === 0) return;

  // Get existing headers or create new ones
  let headers = [];
  if (sheet.getLastRow() === 0) {
    headers = [
      "Search Name",
      "Timestamp",
      "Title",
      "Description",
      "Year",
      "Price",
      "Mileage",
      "Seller",
      "Location",
      "URL",
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  // Prepare the data
  const timestamp = new Date();
  const data = listings.map((listing) => [
    searchName,
    timestamp,
    listing.title,
    listing.description,
    listing.year,
    listing.price,
    listing.mileage,
    listing.seller,
    listing.location,
    listing.url,
  ]);

  // Append the data
  sheet
    .getRange(sheet.getLastRow() + 1, 1, data.length, data[0].length)
    .setValues(data);
}
