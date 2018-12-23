import puppeteer = require('puppeteer');

const MAX_HEADLESSCHROME_LIFESPAN = 80 * 60 * 1000

let count_under_recording = 0;
let baseurl:string;
const concurrent_eventid_arr: string[] = [];
const MAXIMUM_CONCURRENT_RECORDING = 8;

const run = async(event_id? :string) => {
  if (!event_id) {
    console.log('No Event ID!');
    return;
  }
  // const l = new Logger(res);
  count_under_recording = count_under_recording + 1;
  console.log('=============triggered by html request', event_id);
  console.log('number of concurrent recording', count_under_recording);
  if( !is_concuurent_event_suffficient()){
    console.log('!!!!!!!!!!!!!!11too much concurrent recording in this instance!!!!!!!!!!', event_id);
    return;   
  }


  if (!event_id) {
    console.error('Missed parameter: event_id');
    return;
  }else{
    add_concurrent_eventid(event_id);
  }

  try{
    console.log('http response finish and continue headless chrome', event_id);
    await launch_monitor_headlesschrome( event_id);
    console.log(`finish launch monitor headlesschrome -  ${event_id}`);

  }catch(err) {
    console.error('error catch launch_monitor_headlesschrome', err);
  }finally{
    count_under_recording = count_under_recording - 1;
    console.log('=============all process finished', event_id);
    remove_concurrent_eventid(event_id);
  }

}

async function launch_monitor_headlesschrome(event_id: string){
  console.log('launch_monitor_headlesschrome called', event_id);
  const launchTime = Date.now();
  let browser: puppeteer.Browser | null = null;

  try {

    const url = baseurl + "?event_id=" + event_id;

    console.log(`!!!Launch Chrome!!! ${url} :  ${event_id}`, true);
    browser = await puppeteer.launch({
      args: ['--no-sandbox'],
      // dumpio: true
    });
    const browser_version = await browser.version();
    console.log(`browser.version ${browser_version}`);
    browser.on('targetdestroyed', () => console.log(`<<browser event>> targetdestroyed -  ${event_id}`));
    browser.on('targetcreated', () => console.log(`<<browser event>> targetcreated -  ${event_id}`));
    browser.on('targetchanged', () => console.log(`<<browser event>> targetchanged -  ${event_id}`));
    browser.on('disconnected', () => console.log(`<<browser event>> disconnected -  ${event_id}`));

    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 300 });
    // l.page = page;
    page.on('console', async(c) => {
      // await l.log(`${c.type()}: ${c.text()}: ${c.args()}`);
      console.log(`${c.type()}: ${c.text()}-  ${event_id}`);
    });
    page.on('load', () => console.log(`<<page event>> loaded -  ${event_id}`));
    page.on('close', () => console.log(`<<page event>> closed -  ${event_id}`));
    page.on('error', () => console.log(`<<page event>> error -  ${event_id}`));

    await page.goto(url);
    // await page.waitFor(1000);
    console.log(`!!!!!!!Open Page!!!!!!! -  ${event_id}`, true);

    while (true) {
      if ( MAX_HEADLESSCHROME_LIFESPAN < Date.now() - launchTime) {
        console.log(`!!!!!!!TimeOut!!!!!!! - ${MAX_HEADLESSCHROME_LIFESPAN} -  ${event_id}`, true);
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

      await page.waitForSelector('#live_video_basic\\.game_status', { timeout: 120 * 1000 });
      const game_status = await page.$('#live_video_basic\\.game_status');
      const game_status_value = await page.evaluate(game_status => game_status.textContent, game_status);
      if (game_status_value === 'reflection' || game_status_value === 'preparation' || game_status_value === 'intro') {

        console.log(`status: ${game_status_value} and finish`, true);
        await page.waitFor(30000);
        break;
      } else if (game_status_value === 'debate') {
        await page.waitFor(1000);
        // this log is output too many times so it is disabled
        // console.log('waitFor under debate', event_id);
        continue;
      }

      console.log('waitFor last', event_id);
      await page.waitFor(1000);
      continue;
    }
    console.log(`Close Chrome  ${event_id}`, true);
  } catch(e) {
    console.error('launch_monitor_headlesschrome error', e);
    if (e.stack) {
      console.error(e.stack);
    }
  } finally {
    if (browser) {
      console.log(`>>operation<< browser close -  ${event_id}`)
      await browser.close();
    }
  }

}

if (process.argv[2]) {
  const event_id  = process.argv[2];
  console.log(`run: event_id: ${event_id}`);
  baseurl = get_baseurl();
  run(event_id);
} else {
  run();
}

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

function remove_concurrent_eventid(event_id: string) {
  const index = concurrent_eventid_arr.indexOf(event_id)
  if(index !== -1){
    concurrent_eventid_arr.splice(index, 1);
  }
}

function add_concurrent_eventid(event_id: string) {
  concurrent_eventid_arr.push(event_id);
}


function is_concuurent_event_suffficient() {
  console.log('concurrent_eventid_arr', concurrent_eventid_arr);
  const number_of_event = concurrent_eventid_arr.length + 1
  if(number_of_event < MAXIMUM_CONCURRENT_RECORDING){
    return true;
  }
  return false;
}
