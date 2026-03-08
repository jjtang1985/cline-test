import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface LoginCredentials {
  username: string;
  password: string;
}

class SimpleMoodlePDFDownloader {
  private readonly loginUrl = 'https://moodle.humboldtgym.de/login/index.php';
  private cookies: string[] = [];
  private downloadPath: string;

  constructor(downloadPath: string = './downloads') {
    this.downloadPath = downloadPath;
    
    // Create downloads directory if it doesn't exist
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }
  }

  /**
   * Make HTTP request with cookie support
   */
  private makeRequest(url: string, options: any = {}): Promise<{ response: http.IncomingMessage; data: Buffer }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          ...options.headers
        }
      };

      // Add cookies if available
      if (this.cookies.length > 0) {
        requestOptions.headers['Cookie'] = this.cookies.join('; ');
      }

      const req = client.request(requestOptions, (res) => {
        // Store cookies from response
        if (res.headers['set-cookie']) {
          this.cookies = this.cookies.concat(res.headers['set-cookie'].map(cookie => cookie.split(';')[0]));
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          resolve({ response: res, data });
        });
      });

      req.on('error', reject);

      if (options.data) {
        req.write(options.data);
      }

      req.end();
    });
  }

  /**
   * Extract form data from HTML
   */
  private extractFormData(html: string): { [key: string]: string } {
    const formData: { [key: string]: string } = {};
    
    // Extract hidden input fields
    const hiddenInputRegex = /<input[^>]*type=["']hidden["'][^>]*>/gi;
    const matches = html.match(hiddenInputRegex) || [];
    
    matches.forEach(match => {
      const nameMatch = match.match(/name=["']([^"']+)["']/);
      const valueMatch = match.match(/value=["']([^"']*)["']/);
      
      if (nameMatch && valueMatch) {
        formData[nameMatch[1]] = valueMatch[1];
      }
    });

    return formData;
  }

  /**
   * Login to Moodle using HTTP requests
   */
  async login(credentials: LoginCredentials): Promise<boolean> {
    try {
      console.log('Getting login page...');
      
      // Get login page
      const { data: loginPageData } = await this.makeRequest(this.loginUrl);
      const loginPageHtml = loginPageData.toString();
      
      console.log('Extracting form data...');
      
      // Extract form data (including CSRF tokens)
      const formData = this.extractFormData(loginPageHtml);
      console.log('Found form fields:', Object.keys(formData));
      
      // Add credentials to form data
      formData['username'] = credentials.username;
      formData['password'] = credentials.password;
      
      // Convert form data to URL encoded string
      const postData = Object.entries(formData)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

      console.log('Submitting login form...');
      
      // Submit login form
      const { response, data: responseData } = await this.makeRequest(this.loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Referer': this.loginUrl
        },
        data: postData
      });

      console.log('Login response status:', response.statusCode);
      console.log('Response headers:', response.headers);
      
      // Check if we got redirected (successful login usually redirects)
      if (response.statusCode === 302 || response.statusCode === 301) {
        const location = response.headers.location;
        console.log('Redirected to:', location);
        
        // If redirected away from login page, likely successful
        if (location && !location.includes('/login/')) {
          console.log('✅ Login successful! (redirected away from login page)');
          return true;
        }
      }
      
      // Check response content for login success indicators
      const responseHtml = responseData.toString();
      
      // Look for error messages
      const hasLoginError = responseHtml.includes('Invalid login') || 
                           responseHtml.includes('Login failed') ||
                           responseHtml.includes('error') ||
                           responseHtml.includes('incorrect');
      
      // Look for success indicators (logout link, user menu, dashboard)
      const hasLogoutLink = responseHtml.includes('logout') || 
                           responseHtml.includes('Log out') ||
                           responseHtml.includes('Dashboard') ||
                           responseHtml.includes('My courses');
      
      // Still on login page check
      const stillOnLoginPage = responseHtml.includes('Login to the site') ||
                              responseHtml.includes('username') && responseHtml.includes('password');
      
      console.log('Login analysis:');
      console.log('- Has login error:', hasLoginError);
      console.log('- Has logout link:', hasLogoutLink);
      console.log('- Still on login page:', stillOnLoginPage);
      
      const loginSuccess = !hasLoginError && (hasLogoutLink || !stillOnLoginPage);
      
      if (loginSuccess) {
        console.log('✅ Login successful!');
      } else {
        console.log('❌ Login failed!');
        // Save response for debugging
        fs.writeFileSync('./debug-login-response.html', responseHtml);
        console.log('Login response saved to debug-login-response.html for inspection');
      }

      return loginSuccess;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }

  /**
   * Download PDF from URL
   */
  async downloadPDF(credentials: LoginCredentials, pdfUrl: string): Promise<string | null> {
    try {
      // Login first
      const loginSuccess = await this.login(credentials);
      if (!loginSuccess) {
        throw new Error('Login failed');
      }

      console.log(`Downloading PDF from: ${pdfUrl}`);
      
      // Download the PDF
      const { response, data } = await this.makeRequest(pdfUrl);
      
      // Check if response is a PDF
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        console.log('❌ Response is not a PDF file');
        console.log('Content-Type:', contentType);
        
        // Try to find PDF links in the HTML
        const html = data.toString();
        console.log('Searching for PDF links in the page...');
        
        // Save the page for debugging
        fs.writeFileSync('./debug-pdf-page.html', html);
        console.log('Page content saved to debug-pdf-page.html for inspection');
        
        // Check for meta refresh redirect
        const metaRefreshMatch = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i);
        if (metaRefreshMatch) {
          const redirectUrl = metaRefreshMatch[1];
          console.log(`Found meta refresh redirect to: ${redirectUrl}`);
          if (redirectUrl.includes('.pdf') || redirectUrl.includes('forcedownload')) {
            return this.downloadPDFDirect(redirectUrl);
          }
        }
        
        // Check for JavaScript location.replace redirect
        const jsRedirectMatch = html.match(/location\.replace\(['"]([^'"]+)['"]\)/i);
        if (jsRedirectMatch) {
          const redirectUrl = jsRedirectMatch[1];
          console.log(`Found JavaScript redirect to: ${redirectUrl}`);
          if (redirectUrl.includes('.pdf') || redirectUrl.includes('forcedownload')) {
            return this.downloadPDFDirect(redirectUrl);
          }
        }
        
        // Multiple patterns to find PDF links in href attributes
        const pdfPatterns = [
          /href=["']([^"']*\.pdf[^"']*)["']/gi,
          /href=["']([^"']*pluginfile\.php[^"']*)["']/gi,
          /href=["']([^"']*forcedownload[^"']*)["']/gi,
          /href=["']([^"']*mod_resource[^"']*)["']/gi,
          /href=["']([^"']*file\.php[^"']*)["']/gi
        ];
        
        let foundLinks: string[] = [];
        
        pdfPatterns.forEach((pattern, index) => {
          const matches = html.match(pattern) || [];
          console.log(`Pattern ${index + 1} found ${matches.length} matches`);
          
          matches.forEach(match => {
            const linkMatch = match.match(/href=["']([^"']+)["']/);
            if (linkMatch) {
              foundLinks.push(linkMatch[1]);
            }
          });
        });
        
        // Remove duplicates
        foundLinks = [...new Set(foundLinks)];
        console.log(`Found ${foundLinks.length} unique potential PDF links:`);
        foundLinks.forEach((link, index) => {
          console.log(`${index + 1}. ${link}`);
        });
        
        if (foundLinks.length > 0) {
          // Try the first link
          const pdfLink = foundLinks[0];
          console.log(`Trying first PDF link: ${pdfLink}`);
          const fullPdfUrl = pdfLink.startsWith('http') ? pdfLink : new URL(pdfLink, pdfUrl).href;
          return this.downloadPDFDirect(fullPdfUrl);
        }
        
        return null;
      }

      // Generate filename with date
      const urlPath = new URL(pdfUrl).pathname;
      const originalFilename = path.basename(urlPath) || `moodle-pdf-${Date.now()}.pdf`;
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Insert date before file extension
      const ext = path.extname(originalFilename);
      const nameWithoutExt = path.basename(originalFilename, ext);
      const filename = `${nameWithoutExt}_${dateStr}${ext}`;
      const fullPath = path.join(this.downloadPath, filename);
      
      // Save PDF
      fs.writeFileSync(fullPath, data);
      console.log(`✅ PDF downloaded successfully: ${fullPath}`);
      
      return fullPath;
    } catch (error) {
      console.error('Error downloading PDF:', error);
      return null;
    }
  }

  /**
   * Download PDF directly from URL
   */
  private async downloadPDFDirect(pdfUrl: string): Promise<string | null> {
    try {
      console.log(`Downloading PDF directly from: ${pdfUrl}`);
      
      const { data } = await this.makeRequest(pdfUrl);
      
      // Generate filename with date
      const urlPath = new URL(pdfUrl).pathname;
      const originalFilename = path.basename(urlPath) || `moodle-pdf-${Date.now()}.pdf`;
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Insert date before file extension
      const ext = path.extname(originalFilename);
      const nameWithoutExt = path.basename(originalFilename, ext);
      const filename = `${nameWithoutExt}_${dateStr}${ext}`;
      const fullPath = path.join(this.downloadPath, filename);
      
      // Save PDF
      fs.writeFileSync(fullPath, data);
      console.log(`✅ PDF downloaded successfully: ${fullPath}`);
      
      return fullPath;
    } catch (error) {
      console.error('Error downloading PDF directly:', error);
      return null;
    }
  }
}

// Example usage function
async function downloadPDF(): Promise<void> {
  const credentials = {
    username: process.env.MOODLE_USERNAME || '',
    password: process.env.MOODLE_PASSWORD || ''
  };

  const pdfUrl = process.env.PDF_URL || '';

  if (!credentials.username || !credentials.password) {
    console.error('Please provide MOODLE_USERNAME and MOODLE_PASSWORD in your .env file');
    process.exit(1);
  }

  if (!pdfUrl) {
    console.error('Please provide PDF_URL in your .env file');
    console.error('Example: PDF_URL="https://moodle.humboldtgym.de/mod/resource/view.php?id=12345"');
    process.exit(1);
  }

  const downloader = new SimpleMoodlePDFDownloader('./downloads');
  const result = await downloader.downloadPDF(credentials, pdfUrl);
  
  if (result) {
    console.log(`🎉 Success! PDF saved to: ${result}`);
  } else {
    console.log('❌ Failed to download PDF');
    process.exit(1);
  }
}

// Export the class and run example if this file is executed directly
export { SimpleMoodlePDFDownloader };

if (require.main === module) {
  downloadPDF().catch(console.error);
}
