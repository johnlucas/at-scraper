# AutoTrader Scraper

A Node.js scraper for Toyota RAV4 listings on AutoTrader UK.

## Features

- Scrapes Toyota RAV4 listings from AutoTrader UK
- Extracts detailed information including price, mileage, location, and more
- Saves results to CSV file
- Handles pagination automatically
- Uses headless Chrome via Puppeteer

## Requirements

- Node.js >= 18.0.0

## Installation

```bash
npm install
```

## Usage

To run the scraper:

```bash
npm start
```

## Development

To run in development mode:

```bash
npm run dev
```

## Deployment

This app is configured for deployment on Render.com. To deploy:

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use the following settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Node.js version: 18 or higher
