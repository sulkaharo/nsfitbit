// Import the messaging module
import * as messaging from "messaging";
import { encode } from 'cbor';
import { outbox } from "file-transfer";

import Settings from './settings.js';
import dataProcessor from './dataprocessing.js';
import { settingsStorage } from "settings";

// Let's abuse some Globals

let lastKnownRecordDate = 0;
let lastFetch = 0;

let settings = Settings.parseSettings();

function debug() {
  return settings.loggingEnabled;
}

settingsStorage.onchange = function(evt) {
  if (debug()) console.log('Setting changed', evt.key);
  settings = Settings.parseSettings();
  updateDataToClient();
}

function getRequesttOptions () {
  const options = {};

  if (settings.apiSecret && !settings.offline) {
    options.headers = new Headers({
      'api-secret': settings.apiSecret
    });
    if (debug()) console.log('API-SECRET', settings.apiSecret);
  }
  return options;
}

function queryBGD () {

  const url = settings.sgvURL;
  if (debug()) console.log('Fetching SGVs from', url);

  const options = getRequesttOptions();

  return fetch(url, options)
    .then(function(response) {
      return response.json()
        .then(function(data) {
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
          if (data[0].aaps){
            let iob = [];
            if (debug())console.log("split it"+ JSON.stringify(data[0].aaps.split(" ")));
            let aapsdataraw = data[0].aaps.split(" ");
            //["90%","-0.66U","+0.18","0g"]
            //["60%","-0.51U(0.61|-1.12)","+0.90","0g"]
            //[-0.51U(0.61|-1.12)","+0.90","0g"]
            //["-0.66U","+0.18","0g"]
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
            if (aapsdataraw.length == 4){
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
            if (aapsdataraw[iobindx].indexOf('|') > -1){
              if (debug())console.log('Detailed IOB found....');
              let iobraw = aapsdataraw[iobindx].split("(");
              let iobraw1= iobraw[iobindx].split("|");

              iobtotal = iobraw[0];
              aapsdata.iob.bolus = iobraw1[0];
              aapsdata.iob.basal = iobraw1[1].split(")")[0];
            }else {
              if (debug())console.log('Detailed IOB NOT found....');
              iobtotal = aapsdataraw[iobindx];
            }
            //get rid of the Units from IOB
            aapsdata.iob.total = iobtotal.split('U')[0];
            aapsdata.cob = aapsdataraw[cobindx];
            //we dont need a + sign for IOB, check for it and remove it.
            if(aapsdataraw[cobindx].indexOf('+') > -1){
              aapsdata.cob = aapsdataraw[cobindx].split("+")[0];
            }
            aapsdata.bgi = aapsdataraw[bgiindex];

            bgData.aaps = {'cob':aapsdata.cob,'iob':aapsdata.iob.total,'bgi':aapsdata.bgi};
          }

          // Send the data to the device
          return bgData;
        });
    })
    .catch(function(err) {
      if (debug()) console.log("Error fetching glucose data: " + err);
    });
}

function queryTreatments () {

  const url = settings.treatmentURL;
  if (debug()) console.log('Fetching treatments from', url);

  return fetch(url)
    .then(function(response) {
      return response.json()
        .then(function(data) {

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
        });
    })
    .catch(function(err) {
      if (debug()) console.log("Error fetching treatment data: " + err);
    });
}

function queryJSONAPI (url) {
  return fetch(url)
    .then(function(response) {
      return response.json()
        .then(function(data) {
          return data;
        });
    })
    .catch(function(err) {
      if (debug()) console.log("Error fetching data from url: ", url, err);
    });
}

// Send the BG data to the device
function queueFile (data) {
  if (debug()) console.log('Queued a file change');
  const myFileInfo = encode(data);
  outbox.enqueue('file.txt', myFileInfo);
}

const TWO_MINUTES = 2 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

let dataCache = {};

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

  if (loadFromCloud) {
    if (debug()) console.log("Fetching Data");

    // eslint-disable-next-line no-unused-vars
    const BGDPromise = new Promise(function(resolve, reject) {
      resolve(queryBGD());
    });

    const TreatmentPromise = new Promise(function(resolve, reject) {
      resolve(queryTreatments());
    });

    const ProfilePromise = new Promise(function(resolve, reject) {
      resolve(queryJSONAPI(settings.profileURL));
    });

    const V2ApiPromise = new Promise(function(resolve, reject) {
      resolve(queryJSONAPI(settings.v2APIURL));
    });

    const values = await Promise.all([BGDPromise, TreatmentPromise, ProfilePromise, V2ApiPromise]);

    if (debug()) console.log('All promises resolved');
    dataCache = values;
    lastFetch = Date.now();
    return values;
  } else {
    return dataCache;
  }
}

async function updateDataToClient () {

  const values = await loadDataFromCloud();

  const treatments = values[1];
  const profile = values[2];
  let processedBasals = [];

  //if we are offline dont bother trying to update basals as we cant get that data locally yet
  if (!settings.offline){
    try {
      processedBasals = dataProcessor.processTempBasals([profile, treatments.tempBasals]);
    } catch (err) {
      console.log(err);
    }
  }
  const v2data = values[3];

  const state = buildStateMessage(v2data);

  let dataToSend = {
    'BGD': values[0]
    , 'basals': []
    , 'state': []
    , 'settings': settings
    , 'carbs': []
    , 'boluses': []};
  //if AAPS locally broadcasted data is available
  if (values[0].aaps){
    //override blank values with locally broadcasted AAPS ones
    dataToSend.state = {
    'cob':values[0].aaps.cob
    ,'iob':values[0].aaps.iob
    ,'bgi':values[0].aaps.bgi
    ,'bwp':'???'};
  }
  if (!settings.offline){
    dataToSend.state = state;
    dataToSend.basals = processedBasals.reverse();
    dataToSend.carbs = treatments.carbs;
    dataToSend.boluses = treatments.boluses;
  }

  queueFile(dataToSend);
}

Settings.setCallback(updateDataToClient);

//Settings.updateCallback = updateDataFromCloud;

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
    const iobDate = new Date(v2data.iob.mills);
    state.date = iobDate.toISOString();
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
      state.cob = Math.floor(v2data.loop.lastLoop.cob);
      state.iob = Round2Digits(v2data.loop.lastLoop.iob);
      state.insulinReq = v2data.loop.lastLoop.recommendedBolus;
      state.predicted = {
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
    intervalTimer = setInterval(updateDataToClient, 15 * 1000);
    updateDataToClient();
  }
}

instantiateInterval();

// Listen for the onerror event
messaging.peerSocket.onerror = function(err) {
  // Handle any errors
  if (debug()) console.log("Connection error: " + err.code + " - " + err.message);
};
