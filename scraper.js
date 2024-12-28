const express = require("express");
const puppeteer = require("puppeteer-core");
const chromeLauncher = require("chrome-launcher");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

async function launchBrowser() {
  // Launch Chrome using chrome-launcher
  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  // Connect puppeteer to the launched Chrome instance
  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${chrome.port}`,
    defaultViewport: { width: 1920, height: 1080 },
  });

  return { browser, chrome };
}

// Page navigation helper
async function navigateToPage(page, url, options = {}) {
  const { waitForSelector = '[data-testid="advertCard"]', timeout = 10000 } =
    options;

  await page.goto(url, { waitUntil: "networkidle2" });

  if (waitForSelector) {
    try {
      await page.waitForSelector(waitForSelector, { timeout });
    } catch (error) {
      console.log(`No elements found for selector: ${waitForSelector}`);
      return false;
    }
  }

  return true;
}

// New helper function to get the total number of pages
async function extractTotalPages(page) {
  const totalPages = await page.evaluate(() => {
    const paginationContainer = document.querySelector(
      "div.at__sc-mhrryp-2.MGZFC"
    );
    if (!paginationContainer) {
      console.log("No pagination container found, defaulting to 1 page");
      return 1;
    }

    const pageLinks = Array.from(
      paginationContainer.querySelectorAll("a.at__sc-dyg8rq-2.bmWDjW")
    );
    const currentPage = paginationContainer.querySelector(
      "span.at__sc-dyg8rq-2.at__sc-dyg8rq-3.bmWDjW.cDQLMB"
    );

    const pageNumbers = [
      ...pageLinks.map((link) => parseInt(link.textContent.trim())),
      currentPage ? parseInt(currentPage.textContent.trim()) : null,
    ].filter((num) => !isNaN(num) && num !== null);

    if (pageNumbers.length === 0) {
      console.log("No valid page numbers found, defaulting to 1 page");
      return 1;
    }

    const maxPage = Math.max(...pageNumbers);
    console.log("Maximum page number found:", maxPage);
    return maxPage;
  });

  return totalPages;
}

// New helper function to extract listings from the current page
async function extractPageListings(page) {
  const pageListings = await page.evaluate(() => {
    const advertCards = Array.from(
      document.querySelectorAll('[data-testid="advertCard"]')
    );

    return advertCards.map((listing) => {
      const titleElement = listing.querySelector(
        'a[data-testid="search-listing-title"] h3'
      );
      const descriptionElement = listing.querySelector(
        'p[data-testid="search-listing-subtitle"]'
      );
      const priceElement = listing.querySelector(
        "span.at__sc-1mc7cl3-7.icLPGk"
      );
      const mileageElement = Array.from(
        listing.querySelectorAll("li.at__sc-1n64n0d-9.hYdVyl")
      ).find((el) => el.textContent.includes("miles"));
      const yearElement = Array.from(
        listing.querySelectorAll("li.at__sc-1n64n0d-9.hYdVyl")
      ).find((el) => el.textContent.includes("reg"));
      const sellerElement = listing.querySelector(
        "span.at__sc-1mc7cl3-15.kLylrw.ideECV"
      );
      const locationElement = listing.querySelector(
        "span.at__sc-m0lx8i-1.grrelV"
      );
      const distanceElement = listing.querySelector(
        "span.at__sc-m0lx8i-2.gJLdRk"
      );
      const urlElement = listing.querySelector(
        'a[data-testid="search-listing-title"]'
      );

      return {
        title: titleElement?.textContent.trim() || "N/A",
        description: descriptionElement?.textContent.trim() || "N/A",
        year: yearElement
          ? yearElement.textContent.trim().split(" ")[0]
          : "N/A",
        price: priceElement?.textContent.trim() || "N/A",
        mileage:
          mileageElement?.textContent.trim().replace(" miles", "") || "N/A",
        seller: sellerElement?.textContent.trim() || "N/A",
        location: locationElement
          ? `${locationElement.textContent
              .trim()
              .replace("Dealer location", "")} ${
              distanceElement?.textContent.trim() || ""
            }`
          : "N/A",
        url: urlElement
          ? `https://www.autotrader.co.uk${urlElement.getAttribute("href")}`
          : "N/A",
      };
    });
  });

  return pageListings;
}

// Core scraping function that can be configured for full or debug mode
async function scrapeAutoTrader(baseURL, options = {}) {
  const { debug = false } = options;
  const logPrefix = debug ? "[DEBUG] " : "";

  let browser, chrome;
  try {
    console.log(`${logPrefix}Launching browser...`);
    const browserSetup = await launchBrowser();
    browser = browserSetup.browser;
    chrome = browserSetup.chrome;

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30000); // 30 seconds timeout for navigation
    await page.setDefaultTimeout(30000); // 30 seconds timeout for other operations

    console.log(`${logPrefix}Navigating to ${baseURL}...`);
    const success = await navigateToPage(page, baseURL);

    if (!success) {
      console.error(`${logPrefix}No listings found.`);
      return [];
    }

    if (debug) {
      // Debug mode: just get first listing
      console.log(`${logPrefix}Extracting single listing...`);
      const listings = await extractPageListings(page);
      const debugListing = listings.length > 0 ? [listings[0]] : [];
      console.log(`${logPrefix}Listing extracted:`, debugListing.length > 0);
      return debugListing;
    } else {
      // Full mode: get all pages
      try {
        await page.waitForSelector("div.at__sc-mhrryp-2.MGZFC", {
          timeout: 5000,
        });
      } catch (error) {
        console.log(`${logPrefix}No pagination found, assuming single page`);
      }

      const totalPages = await extractTotalPages(page);
      console.log(`${logPrefix}Total pages found: ${totalPages}`);
      let allListings = [];

      for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
        const pageURL = `${baseURL}&page=${currentPage}`;
        console.log(
          `${logPrefix}Navigating to page ${currentPage}: ${pageURL}`
        );

        const success = await navigateToPage(page, pageURL);
        if (!success) continue;

        const pageListings = await extractPageListings(page);
        if (pageListings.length === 0) {
          console.error(
            `${logPrefix}No listings extracted from page ${currentPage}.`
          );
        } else {
          console.log(
            `${logPrefix}Extracted ${pageListings.length} listings from page ${currentPage}.`
          );
          allListings = allListings.concat(pageListings);
        }
      }

      console.log(`${logPrefix}Total listings extracted:`, allListings.length);
      return allListings;
    }
  } catch (error) {
    throw error;
  } finally {
    if (browser) await browser.close();
    if (chrome) await chrome.kill();
  }
}

// API endpoint handler helper
async function handleScrapeRequest(req, res, debug = false) {
  try {
    const { baseURL } = req.body;

    if (!baseURL) {
      return res
        .status(400)
        .json({ error: "baseURL is required in request body" });
    }

    const logPrefix = debug ? "[DEBUG] " : "";
    console.log(`${logPrefix}Starting scrape for URL:`, baseURL);

    const listings = await scrapeAutoTrader(baseURL, { debug });

    return res.json({
      success: true,
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.error(`${debug ? "[DEBUG] " : ""}Error during scraping:`, error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// API endpoints
app.post("/scrape", (req, res) => handleScrapeRequest(req, res, false));
app.post("/debug-scrape", (req, res) => handleScrapeRequest(req, res, true));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
