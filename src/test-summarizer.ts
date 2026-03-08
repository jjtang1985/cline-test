import { summarizePDFs, PDFSummarizer } from './pdf-summarizer';

/**
 * Test script to run PDF summarization
 */
async function testPDFSummarization(): Promise<void> {
  console.log('🚀 Starting PDF Summarization Test...\n');
  
  try {
    // Run the main summarization function
    await summarizePDFs();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPDFSummarization().catch(console.error);
}

export { testPDFSummarization };
