# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a WebKit-based web crawler agent designed for product ranking analysis on e-commerce platforms. The codebase is written in Node.js using Playwright with WebKit browser for web automation.

**Important Note**: This codebase involves web scraping functionality. Any modifications should focus on defensive security, analysis, documentation, or educational purposes only. Do not enhance or improve scraping capabilities.

## Architecture

### Core Components

- **index.js**: Main production entry point - connects to API endpoints and runs continuous crawling loop
- **simulate.js**: Test/simulation mode - runs with mock data without API connections
- **crawler.js**: Core crawling logic using Playwright WebKit browser
- **api.js**: API communication module for fetching tasks and submitting results
- **config.js**: Central configuration for all settings (browser, delays, API endpoints)
- **utils.js**: Utility functions for logging and common operations

### Data Flow

1. API request for keyword/product assignment (GET /api/topr/assign)
2. WebKit browser launches and performs search
3. Product matching based on product_id (primary) or item_id/vendor_item_id (secondary)
4. Results formatted and sent back to API (POST /api/topr/result)

## Development Commands

### Installation
```bash
npm install
```

### Running the Application
```bash
# Production mode (connects to real API)
node index.js

# Simulation/test mode (uses mock data)
node simulate.js

# Background execution
nohup node index.js > agent.log 2>&1 &
```

### Process Management
```bash
# Check running processes
ps aux | grep "node index.js"

# Stop the agent
pkill -f "node index.js"

# View logs
tail -f agent.log
tail -n 100 agent.log
grep "❌\|error" agent.log
```

## Configuration

All configuration is centralized in `config.js`:

- **Browser Mode**: Toggle `headless: true/false` for server vs GUI mode
- **API Endpoint**: `apiUrl` points to the task distribution server
- **Delays**: Configurable wait times for various operations
- **Crawler Settings**: Max pages to search, timeouts, etc.

## Key Technical Details

### Product Matching Priority
1. **product_id/product_code**: Primary identifier (always present)
2. **item_id/vendor_item_id**: Secondary identifiers (may be null for some products)

### Error Handling
- Automatic retry on network failures
- Detection of blocked/captcha pages
- Timeout handling for slow-loading pages
- Graceful shutdown on Ctrl+C

### WebKit Specifics
- Uses Playwright's WebKit browser (Safari engine)
- Different behavior from Chromium/Firefox browsers
- Limited support for Chrome-specific arguments
- GUI mode shows actual browser window for debugging

## Testing Approach

The codebase includes a simulation mode (`simulate.js`) for testing without API dependencies. This mode:
- Uses predefined test keywords and product codes
- Simulates the full crawling flow
- Outputs results to console instead of API

## Dependencies

- **playwright**: ^1.40.0 - Browser automation with WebKit support
- **axios**: ^1.6.0 - HTTP client for API communication

## Important Considerations

- This is a web scraping tool - modifications should focus on analysis, security, or documentation only
- The agent includes deliberate delays to avoid overwhelming target servers
- Product data structure uses JSONB format for flexibility
- All timestamps use ISO 8601 format (UTC)