import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { OrchestrationClient } from '@sap-ai-sdk/orchestration';

// Load environment variables
dotenv.config();

// Import pdf-parse for actual text extraction
const pdfParse = require('pdf-parse');

interface SAPAIConfig {
  modelName: string;
  resourceGroup: string;
  deploymentId?: string;
}

interface SummaryResult {
  success: boolean;
  summary?: string;
  error?: string;
  metadata?: {
    pdfPath: string;
    textLength: number;
    modelUsed: string;
    timestamp: string;
  };
}

export class PDFSummarizer {
  private config: SAPAIConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): SAPAIConfig {
    const requiredEnvVars = [
      'AICORE_SERVICE_KEY',
      'SAP_AI_MODEL_NAME'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    return {
      modelName: process.env.SAP_AI_MODEL_NAME!,
      resourceGroup: process.env.SAP_AI_RESOURCE_GROUP || 'default',
      deploymentId: process.env.SAP_AI_DEPLOYMENT_ID
    };
  }


  /**
   * Extract text from PDF file using pdf-parse
   */
  async extractTextFromPDF(pdfPath: string): Promise<string> {
    try {
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found: ${pdfPath}`);
      }

      console.log(`📄 Extracting text from PDF: ${pdfPath}`);
      
      // Read the PDF file as a buffer
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      // Parse the PDF using pdf-parse to extract actual text content
      const data = await pdfParse(pdfBuffer);
      
      console.log(`📖 PDF has ${data.numpages} pages`);
      
      // Get the extracted text content
      const extractedText = data.text;
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content could be extracted from the PDF');
      }
      
      // Clean up the extracted text
      const cleanedText = extractedText
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n')  // Replace multiple newlines with single newline
        .trim();
      
      console.log(`✅ Successfully extracted ${cleanedText.length} characters from PDF`);
      return cleanedText;
    } catch (error) {
      console.error('❌ Error extracting text from PDF:', error);
      throw error;
    }
  }

  /**
   * Generate summary using SAP AI SDK Orchestration
   */
  async generateSummary(text: string): Promise<string> {
    try {
      console.log('🤖 Generating summary using SAP AI SDK Orchestration...');
      console.log('text')
      console.log(text)
      
      const prompt = `Read the following document, which contains a table.
      Every row contains the class name info, as indicated in the table header "Klas", being the second column.
      There might be multiple rows in the table that contain "5L" (class name).
      It's also possible that no "5L" info is shown in this table.
      Extract these information and return the original extracted contents (in German).
      In order to understand the data structure, the orginal header of the table is also needed.

${text}

Summary:`;

      const orchestrationClient = new OrchestrationClient({
        promptTemplating: {
          model: {name: 'gpt-4o'}
        }
      });

      const response = await orchestrationClient.chatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant, that understand both English and German. Follow the user instruction.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.getContent();
      if (!content) {
        throw new Error('No response received from SAP AI SDK');
      }

      const summary = content.trim();
      
      if (!summary) {
        throw new Error('Empty summary received from SAP AI SDK');
      }

      console.log('✅ Summary generated successfully');
      return summary;
    } catch (error) {
      console.error('❌ Error generating summary:', error);
      throw error;
    }
  }

  /**
   * Summarize a PDF file
   */
  async summarizePDF(pdfPath: string): Promise<SummaryResult> {
    const startTime = new Date();
    
    try {
      console.log(`🚀 Starting PDF summarization for: ${pdfPath}`);
      
      // Extract text from PDF
      const extractedText = await this.extractTextFromPDF(pdfPath);
      
      // Generate summary
      const summary = await this.generateSummary(extractedText);
      
      const result: SummaryResult = {
        success: true,
        summary,
        metadata: {
          pdfPath,
          textLength: extractedText.length,
          modelUsed: this.config.modelName,
          timestamp: startTime.toISOString()
        }
      };

      console.log('🎉 PDF summarization completed successfully!');
      return result;
    } catch (error) {
      console.error('❌ PDF summarization failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          pdfPath,
          textLength: 0,
          modelUsed: this.config.modelName,
          timestamp: startTime.toISOString()
        }
      };
    }
  }

  /**
   * Summarize all PDFs in the downloads directory
   */
  async summarizeAllPDFs(downloadsDir: string = './downloads'): Promise<SummaryResult[]> {
    try {
      if (!fs.existsSync(downloadsDir)) {
        throw new Error(`Downloads directory not found: ${downloadsDir}`);
      }

      const files = fs.readdirSync(downloadsDir);
      const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

      if (pdfFiles.length === 0) {
        console.log('📁 No PDF files found in downloads directory');
        return [];
      }

      console.log(`📚 Found ${pdfFiles.length} PDF file(s) to summarize`);

      const results: SummaryResult[] = [];

      for (const pdfFile of pdfFiles) {
        const pdfPath = path.join(downloadsDir, pdfFile);
        console.log(`\n--- Processing: ${pdfFile} ---`);
        
        const result = await this.summarizePDF(pdfPath);
        results.push(result);
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return results;
    } catch (error) {
      console.error('❌ Error summarizing PDFs:', error);
      throw error;
    }
  }

  /**
   * Find and summarize only the latest downloaded PDF file
   */
  async summarizeLatestPDF(downloadsDir: string = './downloads'): Promise<SummaryResult | null> {
    try {
      if (!fs.existsSync(downloadsDir)) {
        throw new Error(`Downloads directory not found: ${downloadsDir}`);
      }

      const files = fs.readdirSync(downloadsDir);
      const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

      if (pdfFiles.length === 0) {
        console.log('📁 No PDF files found in downloads directory');
        return null;
      }

      // Get file stats and sort by modification time (most recent first)
      const pdfFilesWithStats = pdfFiles.map(file => {
        const filePath = path.join(downloadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          mtime: stats.mtime
        };
      }).sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      const latestPdf = pdfFilesWithStats[0];
      console.log(`📚 Found ${pdfFiles.length} PDF file(s), processing latest: ${latestPdf.name}`);
      console.log(`📅 Last modified: ${latestPdf.mtime.toLocaleString()}`);

      console.log(`\n--- Processing latest PDF: ${latestPdf.name} ---`);
      const result = await this.summarizePDF(latestPdf.path);
      
      return result;
    } catch (error) {
      console.error('❌ Error summarizing latest PDF:', error);
      throw error;
    }
  }

  /**
   * Save summary results to a file
   */
  saveSummaryResults(results: SummaryResult[], outputPath: string = './summaries.json'): void {
    try {
      const summaryData = {
        generatedAt: new Date().toISOString(),
        totalFiles: results.length,
        successfulSummaries: results.filter(r => r.success).length,
        failedSummaries: results.filter(r => !r.success).length,
        results
      };

      fs.writeFileSync(outputPath, JSON.stringify(summaryData, null, 2));
      console.log(`💾 Summary results saved to: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error saving summary results:', error);
      throw error;
    }
  }
}

/**
 * Main function to demonstrate PDF summarization
 */
export async function summarizePDFs(): Promise<void> {
  try {
    const summarizer = new PDFSummarizer();
    
    // Summarize only the latest PDF in the downloads directory
    const result = await summarizer.summarizeLatestPDF('./downloads');
    
    if (!result) {
      console.log('No PDFs found to summarize.');
      return;
    }

    // Display result
    console.log('\n' + '='.repeat(80));
    console.log('📋 LATEST PDF SUMMARY RESULT');
    console.log('='.repeat(80));

    console.log(`\n📄 ${path.basename(result.metadata?.pdfPath || 'Unknown')}`);
    console.log('-'.repeat(50));
    
    if (result.success && result.summary) {
      console.log('✅ Status: Success');
      console.log(`📊 Text Length: ${result.metadata?.textLength} characters`);
      console.log(`🤖 Model: ${result.metadata?.modelUsed}`);
      console.log(`⏰ Processed: ${result.metadata?.timestamp}`);
      console.log('\n📝 Summary:');
      console.log(result.summary);
    } else {
      console.log('❌ Status: Failed');
      console.log(`🚨 Error: ${result.error}`);
    }

    // Save result to file (convert single result to array for compatibility)
    summarizer.saveSummaryResults([result]);
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 Latest PDF Summarization Complete!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Export the class and run example if this file is executed directly
if (require.main === module) {
  summarizePDFs().catch(console.error);
}
