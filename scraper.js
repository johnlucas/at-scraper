const puppeteer = require("puppeteer");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

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

// New helper function to write listings to CSV
async function writeListingsToCsv(listings) {
  const csvWriter = createCsvWriter({
    path: "autotrader_listings.csv",
    header: [
      { id: "title", title: "Title" },
      { id: "description", title: "Description" },
      { id: "year", title: "Year" },
      { id: "price", title: "Price" },
      { id: "mileage", title: "Mileage" },
      { id: "seller", title: "Seller" },
      { id: "location", title: "Location" },
      { id: "url", title: "URL" },
    ],
  });

  console.log("Writing data to CSV...");
  await csvWriter.writeRecords(listings);
  console.log("Data saved to autotrader_listings.csv");
}

// Updated main scraper to use the new helper functions
async function scrapeAutoTrader() {
  const baseURL =
    "https://www.autotrader.co.uk/car-search?advertising-location=at_cars&make=Toyota&maximum-mileage=100000&model=RAV4&postcode=E2%200HS&price-to=25000&radius=1500&sort=relevance&year-from=2019";

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920x1080",
    ],
  });
  const page = await browser.newPage();

  // Set a user agent to appear more like a real browser
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Add additional headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  });

  console.log(`Navigating to ${baseURL}...`);
  await page.goto(baseURL, { waitUntil: "networkidle2" });

  // Wait for pagination to load
  try {
    await page.waitForSelector("div.at__sc-mhrryp-2.MGZFC", {
      timeout: 5000,
    });
  } catch (error) {
    console.log("No pagination found, assuming single page");
  }

  console.log("Determining the total number of pages...");
  const totalPages = await extractTotalPages(page);
  console.log(`Total pages found: ${totalPages}`);
  let listings = [];

  for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
    const pageURL = `${baseURL}&page=${currentPage}`;
    console.log(`Navigating to page ${currentPage}: ${pageURL}`);
    await page.goto(pageURL, { waitUntil: "networkidle2" });

    // Wait for the listings container to load
    try {
      await page.waitForSelector('[data-testid="advertCard"]', {
        timeout: 10000,
      });
    } catch (error) {
      console.error(`No listings found on page ${currentPage}.`);
      continue;
    }

    console.log(`Extracting listings from page ${currentPage}...`);

    const pageListings = await extractPageListings(page);

    if (pageListings.length === 0) {
      console.error(`No listings extracted from page ${currentPage}.`);
    } else {
      console.log(
        `Extracted ${pageListings.length} listings from page ${currentPage}.`
      );
      listings = listings.concat(pageListings);
    }
  }

  console.log("Total listings extracted:", listings.length);
  await writeListingsToCsv(listings);
  await browser.close();
}

scrapeAutoTrader().catch((err) => {
  console.error("Error during scraping:", err);
});
