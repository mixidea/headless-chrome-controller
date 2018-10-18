import express = require('express');
import puppeteer = require('puppeteer');
import { Logger } from './log';
const MAX_HEADLESSCHROME_LIFESPAN = 80 * 60 * 1000
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

    await l.log(`!!!Launch Chrome!!! ${url} :  ${event_id}`, true);
    browser = await puppeteer.launch({
      args: ['--no-sandbox']
    });
    browser.on('targetdestroyed', () => console.log(`<<browser event>> targetdestroyed -  ${event_id}`));
    browser.on('targetcreated', () => console.log(`<<browser event>> targetcreated -  ${event_id}`));
    browser.on('targetchanged', () => console.log(`<<browser event>> targetchanged -  ${event_id}`));
    browser.on('disconnected', () => console.log(`<<browser event>> disconnected -  ${event_id}`));

    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 300 });
    l.page = page;
    page.on('console', async(c) => {
      // await l.log(`${c.type()}: ${c.text()}: ${c.args()}`);
      await l.log(`${c.type()}: ${c.text()}`);
    });
    page.on('load', () => console.log(`<<page event>> loaded -  ${event_id}`));
    page.on('close', () => console.log(`<<page event>> closed -  ${event_id}`));
    page.on('error', () => console.log(`<<page event>> error -  ${event_id}`));

    await page.goto(url);
    // await page.waitFor(1000);
    await l.log(`!!!!!!!Open Page!!!!!!! -  ${event_id}`, true);

    while (true) {
      if ( MAX_HEADLESSCHROME_LIFESPAN < Date.now() - launchTime) {
        await l.log(`!!!!!!!TimeOut!!!!!!! - ${MAX_HEADLESSCHROME_LIFESPAN} -  ${event_id}`, true);
        break;
      }

      const aliveButtonElement = await page.$('#alive-check');
      if(aliveButtonElement){
        await aliveButtonElement.click();
      }

      const end_check = await page.$('#end-check');
      const end_check_value = await page.evaluate(end_check => end_check.textContent, end_check);
      if(end_check_value === 'true'){
        console.log('end_check_value is true and finish');
        await page.waitFor(4000);
        break;
      }

      await page.waitForSelector('#live_video_basic\\.game_status', { timeout: 60 * 1000 });
      const game_status = await page.$('#live_video_basic\\.game_status');
      const game_status_value = await page.evaluate(game_status => game_status.textContent, game_status);
      if (game_status_value === 'reflection' || game_status_value === 'preparation' || game_status_value === 'intro') {

        await l.log(`status: ${game_status_value} and finish`, true);
        await page.waitFor(30000);
        break;
      } else if (game_status_value === 'debate') {

        await page.waitFor(1000);
        // console.log('waitFor under debate', event_id);
        continue;
      }

      console.log('waitFor last', event_id);
      await page.waitFor(1000);
      continue;
    }
    await l.log(`Close Chrome  ${event_id}`, true);
  } catch(e) {
    l.error(e);
    if (e.stack) {
      l.error(e.stack);
    }
  } finally {
    if (browser) {
      console.log(`>>operation<< browser close -  ${event_id}`)
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



