import express = require('express');
import puppeteer = require('puppeteer');
import { Logger } from './log';
const MAX_HEADLESSCHROME_LIFESPAN = 60 * 60 * 1000
const app = express();

app.get('/recording/:event_id', async (req, res) => {
  const l = new Logger(res);
  const event_id = req.params.event_id;
  if (!event_id) {
    l.error('Missed parameter: event_id');
    await res.end();
    return;
  }
  await launch_monitor_headlesschrome(req, res, l, event_id);

});

async function launch_monitor_headlesschrome( req: any, res: any, l: Logger , event_id: string){

  const launchTime = Date.now();
  let browser: puppeteer.Browser | null = null;

  try {

    const url = app.locals.baseurl + "?event_id=" + event_id;

    await l.log(`Launch Chrome!!! ${url}`, true);
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

    let speech_id = 0;
    while (true) {
      if ( MAX_HEADLESSCHROME_LIFESPAN < Date.now() - launchTime) {
        await l.log('TimeOut', true);
        break;
      }

      await page.waitForSelector('#live_video_basic\\.game_status', { timeout: 60 * 1000 });
      const game_status = await page.$('#live_video_basic\\.game_status');
      const game_status_value = await page.evaluate(game_status => game_status.textContent, game_status);
      if (game_status_value === 'reflection' || game_status_value === 'preparation' || game_status_value === 'intro') {
        // TODO 間違えて reflection に行ってしまってから戻った場合の検討
        await l.log('Reflection', true);
        break;
      } else if (game_status_value !== 'debate') {
        // preparation の場合など
        await page.waitFor(1000);
        continue;
      }

      const speech_start_time = await page.$('#main_speaker\\.speech_start_time');
      if (speech_start_time) {
        const speech_start_time_value  = await page.evaluate(speech_start_time => speech_start_time.textContent, speech_start_time);
        if (speech_start_time_value && speech_start_time_value !== speech_id) {
          await l.log('Start Record', true);
          speech_id = speech_start_time_value;
        }
      }

      await page.waitFor(1000);
      continue;
    }
    await l.log('Close Chrome', true);
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

}

const port = (process.env.PORT || 8080) as number;
const server = app.listen(port, (error: any) => {
  if (error) {
    return console.error(error);
  }
  app.locals.baseurl = get_baseurl();
});


function get_baseurl(){

  console.info(`App listening on port ${port}`);
  console.log(`NODE_TARGET=${ process.env.NODE_TARGET }`);
  console.log(`GOOGLE_CLOUD_PROJECT=${ process.env.GOOGLE_CLOUD_PROJECT }`);

  if (process.env.NODE_TARGET === 'localhost') {
    return 'http://localhost:4200/index.html';
  }else if (process.env.NODE_TARGET === 'staging' || process.env.GOOGLE_CLOUD_PROJECT === 'mixidea-test-a2f1f') {
    return 'https://mixidea-headlesschrome-test.storage.googleapis.com/index.html';
  }else if (process.env.NODE_TARGET === 'production' || process.env.GOOGLE_CLOUD_PROJECT === 'mixidea-91a20') {
    return 'https://mixidea-headlesschrome.storage.googleapis.com/index.html';
  }

  return 'https://mixidea-headlesschrome.storage.googleapis.com/index.html';
}



