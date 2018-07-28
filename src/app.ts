import express = require('express');
import puppeteer = require('puppeteer');
const app = express();

app.get('/recording/:event_id', async (req, res) => {
  const event_id = req.params.event_id;
  if (!event_id) {
    return res.send('Hello World!');
  }
  let url = 'https://mixidea.org/headless-chrome/recording/';
  if (app.locals.staging) {
    url = 'https://staging.mixidea.org/headless-chrome/recording/';
  } else if (app.locals.localhost) {
    url = 'http://localhost:4200/recording/';
  }
  url = url + event_id;
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
  console.log(`NODE_LOCALHOST=${process.env.NODE_LOCALHOST === 'true'}`);
  if (process.env.NODE_LOCALHOST === 'true') {
    app.locals.localhost = true;
  }
  console.log(`NODE_STAGING=${process.env.NODE_STAGING === 'true'}`);
  if (process.env.NODE_STAGING === 'true') {
    app.locals.staging = true;
  }
});
