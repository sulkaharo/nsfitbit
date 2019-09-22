// Import the messaging module
import * as messaging from "messaging";
import { encode } from 'cbor';
import { outbox } from "file-transfer";

import Settings from './settings.js';

// Let's abuse some Globals

let lastKnownRecordDate = 0;
let lastFetch = 0;
let settings = {};

settings = Settings.parseSettings();

function getRequesttOptions () {
  const options = {};

  if (settings.apiSecret) {
    options.headers = new Headers({
      'api-secret': settings.apiSecret
    });
    console.log('API-SECRET', settings.apiSecret);
  }
  return options;
}

function queryBGD() {
  
  const url = settings.sgvURL;
  console.log('Fetching SGVs from', url);

  const options = getRequesttOptions();

  return fetch(url, options)
    .then(function (response) {
      return response.json()
        .then(function (data) {
          console.log('data0: ' + JSON.stringify(data[0]));

          // throw out MBG entries and take the first 28 entries
          data = data.filter(function (bg) {
            return (bg.sgv && bg.type !== 'mbg' && bg.date);
          }).slice(0, 24);

          let currentBgDate = data[0].date;

          console.log('currentBgDate: ' + currentBgDate);

          // move to a separate function to avoid globals
          if (currentBgDate > lastKnownRecordDate) {
            lastKnownRecordDate = currentBgDate;
          }

          let bgData = [];
          let lastBG = null;

          data.forEach(function (bg) {

            const last = lastBG || bg.sgv;
            const delta = bg.delta ? Math.round(bg.delta) : bg.sgv - last;

            bgData.push({
              sgv: bg.sgv,
              direction: bg.direction,
              date: bg.date,
              delta,
              timedelta: (currentBgDate - bg.date)
            });

            lastBG = bg.sgv;

          });

          lastFetch = Date.now();

          // Send the data to the device
          return bgData.reverse();
        });
    })
    .catch(function (err) {
      console.log("Error fetching glucose data: " + err);
    });
}


function queryTreatments() {
  
  const url = settings.treatmentURL;
  console.log('Fetching treatments from', url);

  return fetch(url)
    .then(function (response) {
      return response.json()
        .then(function (data) {

          // throw out MBG entries and take the first 28 entries
          data = data.filter(function (t) {

            const carbs = isNaN(t.carbs) ? 0: Number(t.carbs);
            const insulin = isNaN(t.insulin) ? 0: Number(t.insulin);

            return !(carbs == 0 && insulin == 0);
          }).slice(0, 10);

          let currentBgDate = new Date(data[0].created_at).getTime();

          const tData = [];

          data.forEach(function (t) {

            const carbs = isNaN(t.carbs) ? 0: Number(t.carbs);
            const insulin = isNaN(t.insulin) ? 0: Number(t.insulin);
            const d =  new Date(t.created_at).getTime();

            tData.push({
              insulin: insulin,
              carbs: carbs,
              date: d,
              timedelta: (currentBgDate - d)
            });

          });

          // Send the data to the device
          return tData.reverse();
        });
    })
    .catch(function (err) {
      console.log("Error fetching treatment data: " + err);
    });
}


// Send the BG data to the device
function returnData(data) {
  console.log('Queued a file change');
  const myFileInfo = encode(data);
  outbox.enqueue('file.txt', myFileInfo);
}

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

function updateDataFromCloud() {

  // Only do a fetch if 5 minutes and 10 seconds has passed
  // Only do one fetch / 60 seconds after that

  let dateNow = Date.now();

  console.log('Delta seconds between now and last record', Math.floor((dateNow - lastKnownRecordDate) / 1000));
  console.log('Seconds since last fetch', Math.floor((dateNow - lastFetch) / 1000));

  if ((dateNow - lastKnownRecordDate) < (FIVE_MINUTES + 10000)) {
    return;
  }
  if ((dateNow - lastFetch) < (ONE_MINUTE)) {
    return;
  }

  console.log("Fetching Data");

  // eslint-disable-next-line no-unused-vars
  let BGDPromise = new Promise(function (resolve, reject) {
    resolve(queryBGD());
  });

  let TreatmentPromise = new Promise(function (resolve, reject) {
    resolve(queryTreatments());
  });

  Promise.all([BGDPromise, TreatmentPromise]).then(function (values) {
    let dataToSend = {
      'BGD': values[0],
      'treatments': values[1],
      'settings': settings
    };
    returnData(dataToSend);
  });
}


// Listen for messages from the device
messaging.peerSocket.onmessage = function (evt) {
  console.log('Got ping from device', JSON.stringify(evt.data));
  if (evt.data) {
    instantiateInterval();
    //updateDataFromCloud();
  }
};

let intervalTimer = null;

function instantiateInterval() {
  const dateNow = Date.now();
  const timeSinceLastFetch = dateNow - lastFetch;

  if (!intervalTimer || timeSinceLastFetch > 6*60*1000) {
    console.log('Reinstantiating the timer');
    if (intervalTimer) clearInterval(intervalTimer);
    intervalTimer = setInterval(updateDataFromCloud, 15 * 1000);
    updateDataFromCloud();
  }
}

instantiateInterval();

// Listen for the onerror event
messaging.peerSocket.onerror = function (err) {
  // Handle any errors
  console.log("Connection error: " + err.code + " - " + err.message);
};

