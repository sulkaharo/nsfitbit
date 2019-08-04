// Import the messaging module
import * as messaging from "messaging";
import { encode } from 'cbor';
import { outbox } from "file-transfer";
import { settingsStorage } from "settings";

// // default URL pointing at xDrip Plus endpoint
var URL = null;

var lastKnownRecordDate = 0;
var lastFetch = 0;

var settings = {};

function queryBGD() {
  
  let url = settings.apiURL;
  console.log(url);

  return fetch(url)
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

          let bloodSugars = [];
          let lastBG = null;

          data.forEach(function (bg) {

            const last = lastBG || bg.sgv;
            const delta = bg.delta ? Math.round(bg.delta) : bg.sgv - last;

            bloodSugars.push({
              sgv: bg.sgv,
              direction: bg.direction,
              date: bg.date,
              delta,
              timedelta: (currentBgDate - bg.date)
            });

            lastBG = bg.sgv;

          });

          // Send the data to the device
          return bloodSugars.reverse();
        });
    })
    .catch(function (err) {
      console.log("Error fetching bloodSugars: " + err);
    });
}


// Send the BG data to the device
function returnData(data) {
  console.log('Queued a file change');
  const myFileInfo = encode(data);
  outbox.enqueue('file.txt', myFileInfo);
}

function formatReturnData() {

  // Only do a fetch if 5 minutes and 10 seconds has passed
  // Only do one fetch / 60 seconds after that

  let dateNow = (new Date()).getTime();

  console.log("Checking if fetch is needed: " + dateNow);
  console.log('lastKnownRecordDate: ' + lastKnownRecordDate);
  console.log('lastFetch: ' + lastFetch);

  if ((dateNow - lastKnownRecordDate) < (5 * 60 * 1000 + 10000)) {
    return;
  }
  if ((dateNow - lastFetch) < (2 * 60 * 1000)) {
    return;
  }

  lastFetch = dateNow;

  console.log("Fetching Data...");

  // eslint-disable-next-line no-unused-vars
  let BGDPromise = new Promise(function (resolve, reject) {
    resolve(queryBGD());
  });

  Promise.all([BGDPromise]).then(function (values) {
    let dataToSend = {
      'BGD': values[0],
      'settings': settings
    };
    returnData(dataToSend);
  });
}


// Listen for messages from the device
messaging.peerSocket.onmessage = function (evt) {
  if (evt.data) {
    formatReturnData();
  }
};


setInterval(formatReturnData, 15 * 1000);

// Listen for the onerror event
messaging.peerSocket.onerror = function (err) {
  // Handle any errors
  console.log("Connection error: " + err.code + " - " + err.message);
};


// converts a mg/dL to mmoL
function mmol(bg) {
  let mmolBG = Math.round((0.0556 * bg) * 10) / 10;
  return mmolBG;
}

// converts mmoL to  mg/dL 
function mgdl(bg) {
  let mgdlBG = Math.round((bg * 18) / 10) * 10;
  return mgdlBG;
}

//----------------------------------------------------------
//
// This section deals with settings
//
//----------------------------------------------------------

parseSettings();

settingsStorage.onchange = function (evt) {
  console.log('Setting changed', evt.key, getSettings(evt.key));
  parseSettings();
  formatReturnData();
};

function parseSettings() {

  settings.units = settingsStorage.getItem('usemgdl') === 'true' ? 'mgdl' : 'mmol';

  // thresholds are always mgdl
  settings.highThreshold = Number(getSettings('highThreshold', 200));
  settings.lowThreshold = Number(getSettings('lowThreshold', 70));

  if (settings.units == 'mmol') {
    settings.highThreshold = mgdl(settings.highThreshold);
    settings.lowThreshold = mgdl(settings.lowThreshold);
  }

  settings.apiURL = getSgvURL();
  console.log('API URL set to', settings.apiURL);

  settings.timeFormat = '24h';
  settings.bgColor = 'black';

}

// getters 
function getSettings(key, defvalue) {

  const keyValue = settingsStorage.getItem(key);

  if (keyValue) {
    console.log(key, 'value is', keyValue);
    const parsed = JSON.parse(keyValue);
    return parsed.name;
  } else {
    console.log('Setting', key, 'not found, returning', defvalue);
    return defvalue;
  }
}

function getSgvURL() {
  let url = getSettings('endpoint', null);
  if (url) {
    // eslint-disable-next-line no-useless-escape
    const parsed = url.match(/^(http|https|ftp)?(?:[\:\/]*)([a-z0-9\.-]*)(?:\:([0-9]+))?(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i);
    const host = parsed[2];
    url = 'https://' + host + '/api/v1/entries.json?count=40';
    console.log('Loading data from', url);
    return url;
  } else {
    // Default xDrip web service 
    return "http://127.0.0.1:17580/sgv.json";
  }
}