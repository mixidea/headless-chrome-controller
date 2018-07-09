import express = require('express');
import puppeteer = require('puppeteer');
const app = express();

app.use(async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.send('Hello World!');
  }
  const browser = await puppeteer.launch({
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(url);
  const imageBuffer = await page.screenshot();
  browser.close();

  res.set('Content-Type', 'image/png');
  res.send(imageBuffer);
});

const port = (process.env.PORT || 8080) as number;
const server = app.listen(port, (error: any) => {
  if (error) {
    return console.error(error);
  }
  console.info(`App listening on port ${port}`);
});

