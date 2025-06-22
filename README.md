# KOOMENJUE AI Chat - Production Build

This is the compiled production version of the KOOMENJUE AI Chat Application.

## What's Included

- **Compiled server** (`index.js`) - 21KB bundled Node.js application
- **Frontend assets** (`public/`) - Optimized React application (289KB JS + 80KB CSS)
- **Production dependencies** (`package.json`) - Minimal runtime dependencies
- **Deployment guide** (this README)

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set environment variable:
```bash
export GEMINI_API_KEY=your_api_key_here
```

3. Start the application:
```bash
npm start
```

The application will run on port 5000 by default.

## Environment Variables

- `GEMINI_API_KEY` - Your Google Gemini API key (required)
- `PORT` - Port to run the server on (default: 5000)

## Files

- `index.js` - Compiled server application
- `public/` - Static frontend assets
- `package.json` - Production dependencies

## Deployment

This build is ready for deployment to any Node.js hosting platform including:
- Heroku
- Railway
- Render
- DigitalOcean App Platform
- AWS/GCP/Azure

---

**Developed by Fidelis Munene Gitonga**  
🔹 Entrepreneur | IT Consultant | Software Developer | Data Analyst  
📌 Director & Owner – Seradelis Waste Management | Eco Freelance Technology Plus | Jackleo Construction