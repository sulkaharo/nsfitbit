// Import the messaging module
import * as messaging from "messaging";
import { encode } from 'cbor';
import { outbox } from "file-transfer";
import { sha1 } from "./sha1.js";

import Settings from './settings.js';
import dataProcessor from './dataprocessing.js';
import { settingsStorage } from "settings";
import { locale } from "user-settings";

// Let's abuse some Globals

let lastKnownRecordDate = 0;
let lastFetch = 0;

let settings = Settings.parseSettings();

function debug () {
  return settings.loggingEnabled;
}

settingsStorage.onchange = function(evt) {
  if (debug()) console.log('Setting changed', evt.key);
  settings = Settings.parseSettings();
  queueFile('settings.cbor', getClientSettings());
  updateDataToClient();
}

function getRequesttOptions (xdrip) {
  const options = {};
  let apisecret = settings.apiSecret;
  if (xdrip && settings.apiSecret) {
    //sha1 the API secret as thats required for xdrip if using API secret
    apisecret = sha1(settings.apiSecret);
  }
  if (settings.apiSecret) {
    options.headers = new Headers({
      'api-secret': apisecret
    });
    if (debug()) console.log('API-SECRET', apisecret);
  }
  return options;
}

async function queryBGD () {

  const url = settings.sgvURL;
  if (debug()) console.log('Fetching SGVs from', url);

  const response = await fetch(url, getRequesttOptions());

  if (!response.ok) {
    console.log('Error fetching blood glucose data, trying xDrip');
    const response = await fetch('http://127.0.0.1:17580/sgv.json?count=48', getRequesttOptions(true));

    if (!response.ok) {
      return;
    }
  }

  let data = await response.json();
  if (debug()) console.log('data0: ' + JSON.stringify(data[0]));

  // throw out MBG entries

  const dataCap = settings.cgmHours * (60 / 5);

  data = data.filter(function(bg) {
    return (bg.sgv && bg.type !== 'mbg' && bg.date);
  }).slice(0, dataCap);

  let currentBgDate = data[0].date;

  if (debug()) console.log('currentBgDate: ' + currentBgDate);

  // move to a separate function to avoid globals
  if (currentBgDate > lastKnownRecordDate) {
    lastKnownRecordDate = currentBgDate;
  }

  let bgData = [];
  let lastBG = null;

  data.forEach(function(bg) {

    const last = lastBG || bg.sgv;

    bgData.push({
      sgv: bg.sgv
      , direction: bg.direction
      , date: bg.date
      , noise: bg.noise
    });

    lastBG = bg.sgv;

  });

  lastFetch = Date.now();

  //This is rather yuck as xdrip broadcasts anything in the first 1st value of sgv values
  //but better than not having anything
  //the AAPS localbroadcast looks like:
  //"aaps":"0% 3.47U(5.35|-1.88) -0.63 40g"
  //"aaps-ts":1572681179398

  //Lets do some stuff with the AAPS broadcast if we have it
  let aapsdata = {};

  //if aaps exists in the broadcast then aaps-ts key will have a date
  if (data[0].aaps) {
    let iob = [];
    if (debug()) console.log("split it" + JSON.stringify(data[0].aaps.split(" ")));
    let aapsdataraw = data[0].aaps.split(" ");
    //"-1.34U(0.15|-1.49) +2.27 0g".split(" ");
    //"90% -0.66U +0.18 0g".split(" ");
    //"60% -0.51U(0.61|-1.12) +0.90 0g".split(" ");
    //"-0.66U +0.18 0g".split(" ");
    //OK we have some data
    //but it can change depending on AAPS settings
    //One way is
    //[0] => Temporary basal
    //[1] => Insulin on Board Total(BolusIOB|BasalIOB)
    //[2] => BGI
    //[3] => COB
    //OR
    //[0] => Insulin on Board Total(BolusIOB|BasalIOB)
    //[1] => BGI
    //[2] => COB

    //difine the indexs where data should be
    //overide if needed
    let iobindx = 0;
    let bgiindex = 1;
    let cobindx = 2;
    //check what dataset we have
    if (aapsdataraw.length == 4) {
      iobindx = 1;
      bgiindex = 2;
      cobindx = 3;
    }

    //lets do some cleaning on the IOB
    //some hairy parsing....real hairy.

    let iobtotal = 0;

    aapsdata.iob = {};
    aapsdata.iob.bolus = '???';
    aapsdata.iob.basal = '???';
    aapsdata.iob.total = '???';
    //check if detailed iob is being broadcast
    if (aapsdataraw[iobindx].indexOf('|') > -1 || aapsdataraw[iobindx + 1].indexOf('|') > -1) {
      if (debug()) console.log('Detailed IOB found....');
      let iobraw = aapsdataraw[iobindx].split("(");
      let iobraw1 = iobraw[1].split("|");

      iobtotal = iobraw[0];
      aapsdata.iob.bolus = iobraw1[0];
      aapsdata.iob.basal = iobraw1[1].split(")")[0];
    } else {
      if (debug()) console.log('Detailed IOB NOT found....');
      iobtotal = aapsdataraw[iobindx];
    }
    //get rid of the Units from IOB
    aapsdata.iob.total = iobtotal.split('U')[0];
    aapsdata.cob = aapsdataraw[cobindx];
    //we dont need a + sign for IOB, check for it and remove it.
    if (aapsdataraw[cobindx].indexOf('+') > -1) {
      aapsdata.cob = aapsdataraw[cobindx].split("+")[0];
    }
    aapsdata.bgi = aapsdataraw[bgiindex];

    bgData.aaps = { 'cob': aapsdata.cob, 'iob': aapsdata.iob.total, 'bgi': aapsdata.bgi };
  }

  // Send the data to the device
  return bgData;
}

async function queryTreatments () {

  const url = settings.treatmentURL;
  if (debug()) console.log('Fetching treatments from', url);

  const options = getRequesttOptions();
  const response = await fetch(url, options);

  if (!response.ok) {
    console.log('Error fetching treatment data: ', response.statusText);
    return;
  }

  let data = await response.json();

  const tempBasals = data.filter(function(t) {
    return (t.eventType == 'Temp Basal');
  });

  const carbArray = [];
  const bolusArray = [];

  data.forEach(function(t) {

    if (t.eventType == 'Temp Basal') return;

    const carbs = isNaN(t.carbs) ? 0 : Number(t.carbs);
    const insulin = isNaN(t.insulin) ? 0 : Number(t.insulin);
    const d = new Date(t.created_at).getTime();

    if (carbs) carbArray.push({
      carbs
      , date: d
    });

    if (insulin) bolusArray.push({
      insulin
      , date: d
    });

  });

  return {
    tempBasals: tempBasals.slice(0, 40).reverse()
    , carbs: carbArray.slice(0, 40)
    , boluses: bolusArray.slice(0, 40)
  }
}

async function queryJSONAPI (url) {

  const options = getRequesttOptions();
  const response = await fetch(url, options);

  if (!response.ok) {
    console.log('Error fetching data from ', url);
    return;
  }

  let data = await response.json();
  return data;
}

// Send the BG data to the device
function queueFile (filename, data) {
  if (debug()) console.log('Queued a file change: ' + filename);
  const myFileInfo = encode(data);
  outbox.enqueue(filename, myFileInfo);
}

const TWO_MINUTES = 2 * 59 * 1000;
const ONE_MINUTE = 58 * 1000;

let dataCache = [];

async function loadDataFromCloud () {

  // Only do a fetch if 5 minutes and 10 seconds has passed
  // Only do one fetch / 60 seconds after that

  let dateNow = Date.now();

  if (debug()) console.log('Delta seconds between now and last record', Math.floor((dateNow - lastKnownRecordDate) / 1000));
  if (debug()) console.log('Seconds since last fetch', Math.floor((dateNow - lastFetch) / 1000));

  let loadFromCloud = true;

  if ((dateNow - lastKnownRecordDate) < (TWO_MINUTES)) {
    loadFromCloud = false;
  }
  if ((dateNow - lastFetch) < (ONE_MINUTE)) {
    loadFromCloud = false;
  }

  lastFetch = Date.now();

  if (loadFromCloud) {
    console.log("Fetching Data from Nightscout");

    const BGDPromise = queryBGD();
    const TreatmentPromise = queryTreatments();
    const ProfilePromise = queryJSONAPI(settings.profileURL);
    const V2ApiPromise = queryJSONAPI(settings.v2APIURL);

    const values = await Promise.all([BGDPromise, TreatmentPromise, ProfilePromise, V2ApiPromise]);
    if (debug()) console.log('All promises resolved');

    // update whatever cached data we got

    if (values[0]) dataCache[0] = values[0];
    if (values[1]) dataCache[1] = values[1];
    if (values[2]) dataCache[2] = values[2];
    if (values[3]) dataCache[3] = values[3];
  }

  return dataCache;
}

function clone (src) {
  return Object.assign({}, src);
}

function getClientSettings () {
  let s = clone(settings);

  delete s.sgvURL;
  delete s.treatmentURL;
  delete s.pebbleURL;
  delete s.profileURL;
  delete s.v2APIURL;
  delete s.apiSecret;
  return s;
}

function treatmentTimeFilter (data, mills) {
  return data.filter(function(entry) {
    return (entry.date > mills);
  });
}

async function updateDataToClient () {

  try {

    const values = await loadDataFromCloud();

    const treatments = values[1];
    const profile = values[2];
    let processedBasals = [];

    const dataCap = Date.now() - (settings.cgmHours * 60 * 60 * 1000);
    if (treatments && profile) {
      try {
        processedBasals = dataProcessor.processTempBasals([profile, treatments.tempBasals], dataCap);
      } catch (err) {
        if (debug()) console.log(err);
      }
    }
    const v2data = values[3];

    const state = v2data ? buildStateMessage(v2data) : [];

    const meta = {
      phoneGenerationTime: Date.now()
      , month: new Date().toLocaleString(locale.language, { month: "short" })
    }

    let dataToSend = {
      'BGD': values[0]
      , 'basals': []
      , 'state': []
      , 'settings': settings
      , 'carbs': []
      , 'boluses': []
      , 'meta': meta
    };

    if (values[0] != null) {
      //if AAPS locally broadcasted data is available
      if (values[0].aaps) {
        //override blank values with locally broadcasted AAPS ones
        dataToSend.state = {
          'cob': values[0].aaps.cob
          , 'iob': values[0].aaps.iob
          , 'bgi': values[0].aaps.bgi
          , 'bwp': '???'
        };
      }

      dataToSend.state = state;
      dataToSend.basals = processedBasals.reverse();
      dataToSend.carbs = treatments ? treatmentTimeFilter(treatments.carbs, dataCap) : [];
      dataToSend.boluses = treatments ? treatmentTimeFilter(treatments.boluses, dataCap) : [];
    }

    queueFile('data.cbor', dataToSend);

  } catch (err) {
    console.log("Error compiling data update to client: ", err);
  }

}

Settings.setCallback(updateDataToClient);

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function Round2Digits (v) {
  return Math.round(Number(v) * 100) / 100;
}

function buildStateMessage (v2data) {

  const state = {};
  const now = Date.now();

  if (!v2data) return state;

  if (v2data.iob) {
    state.iob = Round2Digits(v2data.iob.iob);
    state.date = v2data.iob.mills || 0;
  }

  if (v2data.cob) {
    state.cob = Math.floor(v2data.cob.cob);
  }

  if (v2data.bwp) {
    state.bwp = Round2Digits(v2data.bwp.bolusEstimate);
  }

  if (v2data.loop && v2data.loop.lastLoop) {

    const d = new Date(v2data.loop.lastLoop.timestamp);
    if (now - d.getTime() < FIFTEEN_MINUTES) {
      state.date = v2data.loop.lastLoop.timestamp;
      if (v2data.loop.lastLoop.cob) state.cob = Math.floor(v2data.loop.lastLoop.cob.cob);
      if (v2data.loop.lastLoop.iob) state.iob = Round2Digits(v2data.loop.lastLoop.iob.iob);
      if (v2data.loop.lastLoop) state.insulinReq = v2data.loop.lastLoop.recommendedBolus;
      if (v2data.loop.lastLoop.predicted) state.predicted = {
        loop: v2data.loop.lastLoop.predicted.values
        , moment: v2data.loop.lastLoop.predicted.startDate
      }
    }
  } else {

    if (v2data.openaps) {
      state.predicted = v2data.openaps.lastPredBGs;

      const oapsSource = v2data.openaps.lastSuggested || v2data.openaps.lastEnacted;

      if (oapsSource) {
        state.date = oapsSource.moment;
        state.cob = Math.floor(oapsSource.COB);
        state.insulinReq = Round2Digits(oapsSource.insulinReq);
        state.reservoir = oapsSource.reservoir;
      }
    }
  }

  return state;

}

// Listen for messages from the device
messaging.peerSocket.onmessage = function(evt) {
  if (debug()) console.log('Got ping from device', JSON.stringify(evt.data));
  if (evt.data) {
    instantiateInterval();
  }
};

let intervalTimer = null;

function instantiateInterval () {
  const dateNow = Date.now();
  const timeSinceLastFetch = dateNow - lastFetch;

  if (!intervalTimer || timeSinceLastFetch > TWO_MINUTES + 15000) {
    if (debug()) console.log('Reinstantiating the timer');
    if (intervalTimer) clearInterval(intervalTimer);
    intervalTimer = setInterval(updateDataToClient, 60 * 1000);
    updateDataToClient();
  }
}

instantiateInterval();

// Listen for the onerror event
messaging.peerSocket.onerror = function(err) {
  // Handle any errors
  if (debug()) console.log("Connection error: " + err.code + " - " + err.message);
};
