# PDF Summarizer with SAP Cloud SDK Orchestration

This project extends the Moodle PDF downloader with AI-powered PDF summarization using the SAP Cloud SDK Orchestration client.

## Features

- 📄 **PDF Text Extraction**: Extracts text content from PDF files using pdf-parse
- 🤖 **AI Summarization**: Uses SAP Cloud SDK Orchestration to generate comprehensive summaries
- 📊 **Batch Processing**: Processes multiple PDFs in the downloads directory
- 💾 **Results Storage**: Saves summaries to JSON file for later reference
- 🔧 **Error Handling**: Robust error handling with detailed logging

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **SAP AI Core Service** credentials
3. **PDF files** in the `downloads/` directory

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure your SAP AI Core credentials in the `.env` file:
```env
# SAP Cloud SDK Orchestration Configuration
# The SAP Cloud SDK will automatically detect and use this service key
AICORE_SERVICE_KEY='{"clientid": "your-client-id","clientsecret": "your-client-secret","url": "your-auth-url","serviceurls": {"AI_API_URL": "your-ai-api-url"}}'

# Model configuration for orchestration
SAP_AI_MODEL_NAME=gpt-4o
SAP_AI_RESOURCE_GROUP=default

# Optional: Custom deployment ID if using specific deployment
# SAP_AI_DEPLOYMENT_ID=your_deployment_id_here
```

## Usage

### Method 1: Run PDF Summarization Directly

```bash
npm run summarize
```

### Method 2: Run Test Script

```bash
npm run test-summarize
```

### Method 3: Use Programmatically

```typescript
import { PDFSummarizer, summarizePDFs } from './src/pdf-summarizer';

// Option 1: Use the main function
await summarizePDFs();

// Option 2: Use the class directly
const summarizer = new PDFSummarizer();
const result = await summarizer.summarizePDF('./path/to/your/file.pdf');
console.log(result.summary);
```

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AICORE_SERVICE_KEY` | SAP AI Core service key (JSON format) | `'{"clientid": "sb-xxx", "clientsecret": "xxx", "url": "https://xxx.authentication.eu10.hana.ondemand.com", "serviceurls": {"AI_API_URL": "https://api.ai.xxx.aws.ml.hana.ondemand.com"}}'` |
| `SAP_AI_MODEL_NAME` | Model name for summarization | `gpt-4o`, `gpt-4`, `claude-3-sonnet` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SAP_AI_RESOURCE_GROUP` | Resource group name | `default` |
| `SAP_AI_DEPLOYMENT_ID` | Specific deployment ID | (none) |

## Output

The summarizer generates:

1. **Console Output**: Real-time progress and results
2. **JSON File**: `summaries.json` with detailed results including:
   - Summary text
   - Metadata (file path, text length, model used, timestamp)
   - Success/failure status
   - Error messages (if any)

### Example Output Structure

```json
{
  "generatedAt": "2025-02-10T17:30:00.000Z",
  "totalFiles": 2,
  "successfulSummaries": 2,
  "failedSummaries": 0,
  "results": [
    {
      "success": true,
      "summary": "This document discusses...",
      "metadata": {
        "pdfPath": "./downloads/VKlasse_2025-10-02.pdf",
        "textLength": 5420,
        "modelUsed": "gpt-4",
        "timestamp": "2025-02-10T17:30:00.000Z"
      }
    }
  ]
}
```

## API Reference

### PDFSummarizer Class

#### Constructor
```typescript
const summarizer = new PDFSummarizer();
```

#### Methods

##### `extractTextFromPDF(pdfPath: string): Promise<string>`
Extracts text content from a PDF file.

##### `generateSummary(text: string): Promise<string>`
Generates a summary using SAP Cloud SDK Orchestration.

##### `summarizePDF(pdfPath: string): Promise<SummaryResult>`
Processes a single PDF file and returns the result.

##### `summarizeAllPDFs(downloadsDir?: string): Promise<SummaryResult[]>`
Processes all PDF files in the specified directory (defaults to `./downloads`).

##### `saveSummaryResults(results: SummaryResult[], outputPath?: string): void`
Saves results to a JSON file (defaults to `./summaries.json`).

### Functions

##### `summarizePDFs(): Promise<void>`
Main function that processes all PDFs and displays results.

## Error Handling

The system includes comprehensive error handling:

- **Missing Environment Variables**: Clear error messages for missing configuration
- **PDF Processing Errors**: Handles corrupted or unreadable PDF files
- **API Errors**: Catches and reports SAP AI SDK errors
- **File System Errors**: Handles missing directories or permission issues

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Ensure all required environment variables are set in your `.env` file

2. **"PDF file not found"**
   - Check that PDF files exist in the `downloads/` directory
   - Verify file paths are correct

3. **"No text could be extracted from the PDF"**
   - PDF might be image-based or corrupted
   - Try with a different PDF file

4. **SAP AI SDK connection errors**
   - Verify your SAP AI Core credentials
   - Check network connectivity
   - Ensure the service URL is correct

### Debug Mode

For detailed debugging, check the console output which includes:
- PDF processing progress
- Text extraction results
- API call status
- Error details with stack traces

## Integration with Existing Project

This PDF summarizer integrates seamlessly with the existing Moodle PDF downloader:

1. **Download PDFs**: Use `npm run download` to fetch PDFs from Moodle
2. **Summarize PDFs**: Use `npm run summarize` to process downloaded PDFs
3. **Combined Workflow**: Download and summarize in sequence

## Performance Considerations

- **Rate Limiting**: Built-in 1-second delay between API calls
- **Memory Usage**: Large PDFs are processed in chunks
- **Concurrent Processing**: Currently processes PDFs sequentially to avoid rate limits

## Security

- Environment variables are used for sensitive credentials
- No credentials are logged or stored in output files
- PDF content is processed locally before sending to AI service

## License

MIT License - see the main project LICENSE file for details.
