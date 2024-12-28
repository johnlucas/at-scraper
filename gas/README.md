# Google Apps Script for AutoTrader Scraper

This Google Apps Script allows you to run the AutoTrader scraper API directly from Google Sheets.

## Setup Instructions

1. Create a new Google Sheet
2. Create a sheet named `searches` with these columns:

   - `search_name`: Name/identifier for the search
   - `url`: The AutoTrader search URL
   - `status`: Either "on" or "off" to control which searches to run

3. Open Script Editor:

   - Tools > Script editor
   - Copy the contents of `src/Code.js` into the editor
   - Replace `YOUR_RENDER_API_URL` with your actual Render deployment URL

4. Save and reload the spreadsheet
   - You should see a new menu item "AutoTrader Scraper"

## Usage

1. In the `searches` sheet, add your AutoTrader search URLs:

   ```
   search_name | url                                    | status
   RAV4 London | https://www.autotrader.co.uk/cars?... | on
   ```

2. Create a new sheet where you want the results

3. Click "AutoTrader Scraper" > "Run Scraper"
   - The script will process all searches with status = "on"
   - Results will be appended to the current sheet

## Results Format

The script will create/append results with these columns:

- Search Name
- Timestamp
- Title
- Description
- Year
- Price
- Mileage
- Seller
- Location
- URL

## Development

The script files in this directory should be version controlled here, but changes need to be manually copied to the Google Apps Script editor.

To modify the script:

1. Make changes in `src/Code.js`
2. Commit changes to git
3. Copy the updated code to your Google Apps Script editor
4. Save and test in Google Sheets

## Future Improvements

Consider using [clasp](https://github.com/google/clasp) for better development workflow:

```bash
npm install -g @google/clasp
clasp login
clasp clone <script-id>
```

This would allow direct pushing of code to Google Apps Script.
