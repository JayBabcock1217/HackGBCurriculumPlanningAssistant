import { Injectable, Logger } from '@nestjs/common';

/**
 * PdfRenderer
 *
 * Renders an HTML string (from docToHtml) to a PDF using a headless Chromium
 * (puppeteer). Used for the "Download PDF" action on generated resources.
 *
 * The browser is launched lazily on first use and reused for the life of the
 * process, so the added memory is paid once, not per request. If Chromium
 * cannot launch (e.g. missing system libraries in a minimal image), the error
 * is surfaced to the caller, which falls back to telling the user PDF is
 * unavailable — the HTML and .docx paths still work.
 */
@Injectable()
export class PdfRenderer {
  private readonly logger = new Logger(PdfRenderer.name);
  private browserPromise: Promise<any> | null = null;

  /** Launch (once) and hold a shared browser instance. */
  private getBrowser(): Promise<any> {
    if (!this.browserPromise) {
      this.browserPromise = import('puppeteer')
        .then(async (mod) => {
          const puppeteer = mod.default;
          this.logger.log('Launching headless Chromium for PDF rendering…');
          const launchOptions: Record<string, unknown> = {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
            ],
          };
          // Use a host-provided Chrome binary (e.g. a mounted puppeteer cache)
          // when CHROME_PATH is set, so we don't depend on the in-image cache.
          if (process.env.CHROME_PATH) {
            launchOptions.executablePath = process.env.CHROME_PATH;
          }
          const browser = await puppeteer.launch(launchOptions);
          this.logger.log('Headless Chromium ready.');
          return browser;
        })
        .catch((e) => {
          // Reset so a later call can retry (e.g. after a transient failure).
          this.browserPromise = null;
          throw e;
        });
    }
    return this.browserPromise;
  }

  /** Render HTML to a PDF Buffer (US Letter, print CSS applied). */
  async render(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      const pdf = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  /** Close the shared browser (called on application shutdown). */
  async close(): Promise<void> {
    if (this.browserPromise) {
      try {
        const browser = await this.browserPromise;
        await browser?.close();
      } catch {
        // ignore
      }
      this.browserPromise = null;
    }
  }
}
