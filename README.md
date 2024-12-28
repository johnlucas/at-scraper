# AutoTrader Scraper API

A REST API service that scrapes Toyota RAV4 listings from AutoTrader UK.

## Features

- REST API endpoints for scraping AutoTrader listings
- Full scraping mode for all listings
- Debug mode for quick testing with single listing
- Configurable search parameters via baseURL
- Headless Chrome automation via Puppeteer

## Requirements

- Node.js >= 18.0.0

## Installation

```bash
npm install
```

## Usage

Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server health status.

### Full Scrape

```
POST /scrape
Content-Type: application/json

{
    "baseURL": "https://www.autotrader.co.uk/car-search?advertising-location=at_cars&make=Toyota&maximum-mileage=100000&model=RAV4&postcode=E2%200HS&price-to=25000&radius=1500&sort=relevance&year-from=2019"
}
```

Scrapes all listings from all pages.

### Debug Scrape

```
POST /debug-scrape
Content-Type: application/json

{
    "baseURL": "https://www.autotrader.co.uk/car-search?advertising-location=at_cars&make=Toyota&maximum-mileage=100000&model=RAV4&postcode=E2%200HS&price-to=25000&radius=1500&sort=relevance&year-from=2019"
}
```

Scrapes only the first listing for quick testing.

## Response Format

Success response:

```json
{
  "success": true,
  "count": 1,
  "listings": [
    {
      "title": "Toyota RAV4",
      "description": "2.5 VVT-h Design CVT Euro 6 (s/s) 5dr",
      "year": "2021",
      "price": "£22,500",
      "mileage": "35,867",
      "seller": "Big Motoring World Wimbledon - See all 717 cars",
      "location": "Tooting (10 miles)",
      "url": "https://www.autotrader.co.uk/car-details/..."
    }
  ]
}
```

Error response:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Deployment

This app is configured for deployment on Render.com. To deploy:

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use the following settings:

   - Build Command: `npm install`
   - Start Command: `npm start`
   - Node.js version: 18 or higher
   - Environment Variables:
     - `PORT`: The port for the server (default: 3000)

4. Additional environment variables for Puppeteer on Render:
   ```
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
   ```
