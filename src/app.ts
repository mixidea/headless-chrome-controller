import express = require('express');
import puppeteer = require('puppeteer');
const app = express();

app.get('/recording/:event_id', async (req, res) => {
  const l = new Logger(res);
  const launchTime = Date.now();
  let browser: puppeteer.Browser | null = null;
  (async() => {
    try {
      const event_id = req.params.event_id;
      if (!event_id) {
        l.error('Missed parameter: event_id');
        await res.end();
        return;
      }
      const url = app.locals.baseurl + event_id;

      await l.log('Launch Chrome', false);
      browser = await puppeteer.launch({
        args: ['--no-sandbox']
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 400, height: 300 });
      l.page = page;
      page.on('console', async(c) => {
        await l.log(`${c.type()}: ${c.text()}: ${c.args()}`);
      });

      await page.goto(url);
      await page.waitFor(1000);
      await l.log('Open Page', true);

      while (true) {
        if (60 * 60 * 1000 < Date.now() - launchTime) {
          await l.log('TimeOut', true);
          break;
        }

        await page.waitForSelector('#live_video_basic\\.game_status', { timeout: 60 * 1000 });
        const game_status = await page.$('#live_video_basic\\.game_status');
        const game_status_value = await page.evaluate(game_status => game_status.textContent, game_status);
        if (game_status_value === 'reflection') {
          // TODO 間違えて reflection に行ってしまってから戻った場合の検討
          await l.log('Reflection', true);
          break;
        } else if (game_status_value !== 'debate') {
          // preparation の場合など
          await page.waitFor(1000);
          continue;
        }

        const start_record = await page.$('#start_record');
        if (start_record) {
          await start_record.click();
          await l.log('Start Record', true);
        }

        await page.waitFor(1000);
        continue;
      }
      await l.log('Close Chrome', false);
    } catch(e) {
      l.error(e);
      if (e.stack) {
        l.error(e.stack);
      }
    } finally {
      if (browser) {
        await browser.close();
      }
      await res.end();
    }
  })();
});

const port = (process.env.PORT || 8080) as number;
const server = app.listen(port, (error: any) => {
  if (error) {
    return console.error(error);
  }
  console.info(`App listening on port ${port}`);
  console.log(`NODE_TARGET=${ process.env.NODE_TARGET }`);
  let baseurl = 'https://mixidea.org/headless-chrome/recording/';
  if (process.env.NODE_TARGET === 'staging') {
    baseurl = 'https://staging.mixidea.org/headless-chrome/recording/';
  } else if (process.env.NODE_TARGET === 'localhost') {
    baseurl = 'http://localhost:4200/recording/';
  }
  app.locals.baseurl = baseurl;
  console.log(`baseurl=${ app.locals.baseurl }`);
});

class Logger {
  private startTime = Date.now();
  page: any;

  constructor(private res: express.Response) { }

  async log(message: string, capture = false) {
    console.log(message);
    let style = 'font-weight: bold;';
    if (! capture) {
      style = 'font-weight: lighter; font-family: monospace;';
    }
    await this.res.write(`<p><span>${(Date.now() - this.startTime) / 1000}:</span> <span style="${style}">${message}</span></p>`);
    if (capture && this.page && ! this.page.isClosed() ) {
      const img = await this.page.screenshot({encoding: 'base64', fullPage: true});
      await this.res.write(`<img src="data:image/png;base64,${img}">`);
    }
  }
  async error(message: any) {
    console.error(message);
    const style = 'font-weight: lighter; font-family: monospace; color: red;';
    await this.res.write(`<p><span>${(Date.now() - this.startTime) / 1000}:</span> <span style="${style}">${message}</span></p>`);
  }
}
