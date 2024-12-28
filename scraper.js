const puppeteer = require("puppeteer");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Browser setup helper
async function setupBrowser() {
  const isRender = process.env.RENDER === "true";
  console.log("Environment:", {
    isRender,
    RENDER: process.env.RENDER,
    CHROME_PATH: process.env.CHROME_PATH,
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD:
      process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD,
  });

  const launchOptions = {
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920x1080",
    ],
  };

  // Add Render-specific configuration
  if (isRender) {
    console.log("Running on Render, configuring Chrome path");
    // Try multiple possible Chrome paths
    const chromePaths = [
      process.env.CHROME_PATH,
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
    ].filter(Boolean); // Remove undefined/null values

    console.log("Checking Chrome paths:", chromePaths);

    // Check each path and use the first one that exists
    const { existsSync } = require("fs");
    const validPath = chromePaths.find((path) => existsSync(path));

    if (!validPath) {
      throw new Error(
        `Chrome not found. Checked paths: ${chromePaths.join(", ")}`
      );
    }

    console.log(`Found Chrome at: ${validPath}`);
    launchOptions.executablePath = validPath;

    // Check if Chrome is executable
    const { execSync } = require("child_process");
    try {
      console.log("Checking Chrome installation...");
      const chromeVersion = execSync(`${validPath} --version`).toString();
      console.log("Chrome version:", chromeVersion);
    } catch (error) {
      console.error("Error checking Chrome:", error.message);
      console.log("Listing available Chrome installations:");
      try {
        const locations = execSync(
          "ls -l /usr/bin/google-chrome* /usr/bin/chromium*"
        ).toString();
        console.log(locations);
      } catch (err) {
        console.error("Error listing Chrome locations:", err.message);
      }
    }
  }

  console.log(
    "Browser launch options:",
    JSON.stringify(launchOptions, null, 2)
  );

  try {
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    });

    return { browser, page };
  } catch (error) {
    console.error("Error launching browser:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
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

  const { browser, page } = await setupBrowser();

  try {
    console.log(`${logPrefix}Navigating to ${baseURL}...`);
    const success = await navigateToPage(page, baseURL);

    if (!success) {
      console.error(`${logPrefix}No listings found.`);
      await browser.close();
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
    await browser.close();
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
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
