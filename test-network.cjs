const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('response', response => {
    if (response.status() === 404) {
      console.log('404:', response.url());
    }
  });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await browser.close();
})();
