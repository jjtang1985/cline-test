# Moodle PDF Downloader

A simple TypeScript script that automatically logs into Moodle and downloads PDFs.

## 🎯 Purpose

This script logs into the Humboldt-Gymnasium Potsdam Moodle website and downloads PDF files automatically. It's designed to be lightweight and work reliably on Mac Silicon without browser dependencies.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Credentials
Copy the example environment file and add your credentials:
```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:
```bash
MOODLE_USERNAME=your_username
MOODLE_PASSWORD=your_password
PDF_URL=https://moodle.humboldtgym.de/mod/resource/view.php?id=12345
```

### 3. Download PDF
```bash
npm run download
```

## 📁 Output

PDFs are automatically saved to the `./downloads` folder with their original filename.

## 🔧 How It Works

1. **Login**: Uses HTTP requests to authenticate with Moodle
2. **Navigate**: Goes to your specified PDF resource URL
3. **Detect**: Finds the actual PDF download link (handles redirects)
4. **Download**: Saves the PDF file locally
5. **Cleanup**: Exits cleanly

## 📝 Finding PDF URLs

To get a PDF URL from Moodle:
1. Log into Moodle manually in your browser
2. Navigate to the course/resource with the PDF
3. Right-click on the PDF resource and copy the link
4. Use that URL in your `.env` file

Example URLs:
- `https://moodle.humboldtgym.de/mod/resource/view.php?id=5823`
- `https://moodle.humboldtgym.de/mod/folder/view.php?id=1234`

## 🔒 Security

- Credentials are stored in `.env` file (git-ignored)
- No browser required - pure HTTP requests
- Runs completely headless

## 📋 Example Output

```
Getting login page...
Extracting form data...
Found form fields: [ 'sesskey', 'testcookies' ]
Submitting login form...
✅ Login successful!
Downloading PDF from: https://moodle.humboldtgym.de/mod/resource/view.php?id=5823
Found meta refresh redirect to: https://moodle.humboldtgym.de/file.php/2/Plaene/Vertretungsplaene/VKlasse.pdf?forcedownload=1
✅ PDF downloaded successfully: downloads/VKlasse.pdf
🎉 Success! PDF saved to: downloads/VKlasse.pdf
```

## 📄 Project Structure

```
├── src/
│   └── index.ts          # Main PDF downloader script
├── downloads/            # Downloaded PDFs (created automatically)
├── .env                  # Your credentials (create from .env.example)
├── .env.example          # Template for credentials
└── package.json          # Project configuration
```

## 🛠️ Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run compiled version
npm start
```

This is a focused, no-frills solution for automated PDF downloads from Moodle.
