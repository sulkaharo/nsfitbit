// Imports
import { display } from "display";
import clock from "clock";
import * as messaging from "messaging";
import document from "document";
import { inbox } from "file-transfer";
import * as fs from "fs";
import { vibration } from "haptics";
import { preferences } from "user-settings";
import { today } from "user-activity";
import { HeartRateSensor } from "heart-rate";
import { battery } from "power";

import Graph from "./graph.js";

// Update the clock every minute
clock.granularity = "minutes";

// Variables

let arrowIcon = {
  "Flat": '\u{2192}'
  , "DoubleUp": "\u{2191}\u{2191}"
  , "SingleUp": "\u{2191}"
  , "FortyFiveUp": "\u{2197}"
  , "FortyFiveDown": "\u{2198}"
  , "SingleDown": "\u{2193}"
  , "DoubleDown": "\u{2193}\u{2193}"
  , "None": "-"
  , "NOT COMPUTABLE": "-"
  , "RATE OUT OF RANGE": "-"
};
let minsAgo = 0;
let minsAgoText = "mins ago";

const MINUTES_10 = 1000 * 60 * 10; // Snooze length

let lastUpdateTime = 0;
let muted = false;
let alarming = false;

// Handles to GUI Elements
const time = document.getElementById('time');
const iobLabel = document.getElementById('iob');
const bwpLabel = document.getElementById('bwp');

const steps = document.getElementById("steps");
const hrLabel = document.getElementById('heartrate');
const batteryLabel = document.getElementById('battery');

hrLabel.text = "--";
steps.text = "--";

const sgv = document.getElementById("sgv");
const dirArrow = document.getElementById("dirArrow");

const delta = document.getElementById("delta");
const age = document.getElementById("age");

const scale1 = document.getElementById("scale1");
const scale2 = document.getElementById("scale2");
const scale3 = document.getElementById("scale3");
const scale4 = document.getElementById("scale4");

const docGraph = document.getElementById("docGraph");
let myGraph = new Graph(docGraph);

var settings = {};

// converts a mg/dL to mmoL
function mmol (bg) {
  let mmolBG = Math.round((0.0556 * bg) * 10) / 10;
  return mmolBG.toFixed(1);
}

// converts mmoL to  mg/dL 
function mgdl (bg) {
  let mgdlBG = Math.round((bg * 18) / 10) * 10;
  return mgdlBG;
}

//----------------------------------------------------------
//
// This section is for displaying the heart rate
//
//----------------------------------------------------------

// Create a new instance of the HeartRateSensor object
var hrm = new HeartRateSensor();

const hrmUpdateInterval = 5000;
let hrmLastUpdated = 0;

// Declare a even handler that will be called every time a new HR value is received.
hrm.onreading = function() {
  // Peek the current sensor values
  const now = Date.now();
  if ((Date.now() - hrmLastUpdated) > hrmUpdateInterval) {
      //console.log("Current heart rate: " + hrm.heartRate);
      hrLabel.text = hrm.heartRate;
      hrmLastUpdated = now;
  }
};

// Begin monitoring the sensor
hrm.start();

//----------------------------------------------------------
//
// This section deals with getting data from the companion app 
//
//----------------------------------------------------------
// Request data from the companion
function fetchCompanionData (cmd) {
  //setStatusImage('refresh.png')
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    // Send a command to the companion
    console.log('Watch pinging the companion');
    messaging.peerSocket.send({
      command: cmd
    });
  }
}

// Display the data received from the companion
function updateScreenWithLatestGlucose (data) {
  console.log("bg is: " + JSON.stringify(data));

  if (data) {

    let tcolor = "white";

    // sgv is always mgdl, but thresholds are unit-specific

    if (data.sgv >= settings.highThreshold) {
      tcolor = "red";
    } else if (data.sgv <= settings.lowThreshold) {
      tcolor = "red";
    } else {
      tcolor = "green";
    }

    sgv.text = settings.units == 'mgdl' ? data.sgv : mmol(data.sgv) + "" + arrowIcon[data.direction];
    sgv.style.fill = tcolor;

    //dirArrow.text = arrowIcon[data.direction];
    //dirArrow.style.fill = tcolor;

    minsAgo = data.date;
    minsAgoText = Math.round((Date.now() - minsAgo) / 60000);
    age.text = `${minsAgoText} mins ago`;

    if (data.delta > 0) {
      //console.log(`DELTA: +${data.delta} mg/dl`);
      delta.text = `+${mmol(data.delta)} mmol`;
    } else {
      //console.log(`DELTA: ${data.delta} mg/dl`);
      delta.text = `${mmol(data.delta)} mmol`;
    }

  } else {
    sgv.text = '???';
    sgv.style.fill = "red";
    dirArrow.text = '-';
    dirArrow.style.fill = "red";
  }
}

// Event occurs when new file(s) are received
inbox.onnewfile = () => {
  let fileName;
  do {
    // If there is a file, move it from staging into the application folder
    fileName = inbox.nextFile();
    if (fileName) {
      readSGVFile(fileName);
    }
  } while (fileName);
};

let fileLastUpdated =  0;
let latestGlucoseDate = 0;

function readSGVFile (filename) {

  // TODO: have a view that shows no data exists
  // Also WOOOT why is fileExists() not supported?

  fileLastUpdated = Date.now();

  let data;

  try {
    data = fs.readFileSync(filename, 'cbor');
  } catch (e) {
    console.log('File read failed');
    return;
  }
  if (!data.BGD) return;

  settings = data.settings;

  const hour = new Date().getHours();
  const nightTimeOff = (hour >= 22 || hour <= 7) && settings.offOnNight;

  if (settings.displayOn && !nightTimeOff) {
    display.autoOff = false;
    display.on = true;
  } else {
    display.autoOff = true;
    display.on = true;
  }

  let lastEntry = data.BGD[data.BGD.length - 1];

  checkAlarms(lastEntry);
  updateScreenWithLatestGlucose(lastEntry);
  latestGlucoseDate = lastEntry.date;

  // Added by NiVZ    
  let ymin = 999;
  let ymax = 0;

  data.BGD.forEach(function(bg) {
    if (bg.sgv < ymin) {
      ymin = bg.sgv;
    }
    if (bg.sgv > ymax) {
      ymax = bg.sgv;
    }
  });

  ymin -= 20;
  ymax += 20;

  ymin = Math.floor((ymin / 10)) * 10;
  ymax = Math.floor(((ymax + 9) / 10)) * 10;

  ymin = ymin < 40 ? ymin : 40;
  ymax = ymax < 180 ? 180 : ymax;

  scale1.text = mmol(ymax);
  scale2.text = mmol(Math.floor(ymin + ((ymax - ymin) * 0.66)));
  scale3.text = mmol(Math.floor(ymin + ((ymax - ymin) * 0.33)));
  scale4.text = mmol(ymin);

  const stateData = data.pebble.bgs[0];

  if (stateData.iob) {
    iobLabel.text = "IOB " + stateData.iob;
    if (stateData.bwp) bwpLabel.text = "BWP " + stateData.bwp;
  } else {
    iobLabel.text = "";
    bwpLabel.text = "";
  }

  // Set the graph scale
  myGraph.setYRange(ymin, ymax);
  // Update the graph
  myGraph.update(data.BGD, settings.highThreshold, settings.lowThreshold);
  if (data.treatments) {
    myGraph.updateTreatments(data.treatments);
  }
}

function checkAlarms (entry) {

  const sgv = entry.sgv;

  if (alarming && sgv < settings.highThreshold && sgv > settings.lowThreshold) {
    console.log('BG normal, clearing alarm mutes');

    stopVibration();
    muted = false;
    alarming = false;
    clearTimeout(vibrationTimeout);
  }

  if (alarming || muted) {
    console.log('Alarming or muted, not checking alarms', alarming, muted);
    return;
  }

  const displayGlucose = settings.units === "mgdl" ? sgv : mmol(sgv);

  if (sgv >= settings.highThreshold) {
    console.log('BG HIGH, triggering alarm');
    startVibration("nudge", displayGlucose);
  }

  if (sgv <= settings.lowThreshold) {
    console.log('BG LOW, triggering alarm');
    startVibration("nudge", displayGlucose);
  }
}

let vibrationTimeout;

function startVibration (type, message) {
  console.log('Showing alarm (new or unsnoozed)');
  alarming = true;
  showAlert(message);
  vibration.start(type);
  vibrationTimeout = setTimeout(function() {
    startVibration(type, message);
  }, MINUTES_10);
}

function stopVibration () {
  alarming = false;
  vibration.stop();
  clearTimeout(vibrationTimeout);
}

//----------------------------------------------------------
//
// Alerts
//
//----------------------------------------------------------
let myPopup = document.getElementById("popup");
let btnLeft = myPopup.getElementById("btnLeft");
let btnRight = myPopup.getElementById("btnRight");
let alertHeader = document.getElementById("alertHeader");

function showAlert (message) {
  console.log('ALERT BG');
  console.log(message);
  alertHeader.text = message;
  myPopup.style.display = "inline";
}

// eslint-disable-next-line no-unused-vars
btnLeft.onclick = function(evt) {
  console.log("Mute");
  // TODO This needs to mute it for 15 mins
  myPopup.style.display = "none";
  muted = true;
  stopVibration();
};

// eslint-disable-next-line no-unused-vars
btnRight.onclick = function(evt) {
  console.log("Snooze");
  myPopup.style.display = "none";
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The updater is used to update the screen every 1 SECONDS 
function updateClock () {

  const nowDate = new Date();
  const hours = nowDate.getHours();
  const mins = nowDate.getMinutes();
  const month = monthNames[nowDate.getMonth()];
  const day = nowDate.getDate();
  

  if (mins < 10) { mins = `0${mins}`; }

  const dateText = `${month} ${day} `;

  const ampm = hours < 12 ? "AM" : "PM";

  if (preferences.clockDisplay === "12h") {
    time.text = dateText + `${hours%12 ? hours%12 : 12}:${mins} ${ampm}`;
  } else {
    time.text = dateText + `${hours}:${mins}`;
  }

  steps.text = today.local.steps || 0;
  batteryLabel.text = Math.floor(battery.chargeLevel) + "%";

  // battery icon

  let b = 0;
  if (battery.chargeLevel > 25) b = 1;
  if (battery.chargeLevel > 50) b = 2;
  if (battery.chargeLevel > 75) b = 3;
  if (battery.chargeLevel > 90) b = 3;

  for (let i = 0; i < 5; i++) {
    const bImage = document.getElementById('b'+ i);
    if (i == b) {
      bImage.style.visibility = 'visible';
    } else {
      bImage.style.visibility = 'hidden';
    }
  }

  // Update mins ago
  if (minsAgo > 0) {
    minsAgoText = Math.round((Date.now() - minsAgo) / 60000);
    age.text = `${minsAgoText} mins ago`;
    age.style.fill = 'green';
    if (minsAgoText > 10) age.style.fill = 'red';
  }

  // Update from file if ...

  const nowMoment = nowDate.getTime();
  const timeDelta = nowMoment - lastUpdateTime;

  if (timeDelta > (1000 * 60)) {
    console.log('Periodic display update');
    readSGVFile('file.txt');
  }

}

// Have clock ping the Compantion to keep it alive

messaging.peerSocket.onopen = function() {
  console.log("Socket Open");
};

const dataPingInterval = 5 * 60 * 1000;
let lastPinged = 0;

function checkNeedForPing() {
  const now = Date.now();
  const timeSinceLastGlucose = now - latestGlucoseDate; // fileLastUpdated;
  const lastPingDelta = now - lastPinged;

  //console.log('Checking if I need to ping companion');

  if (lastPingDelta > 30 * 1000 && timeSinceLastGlucose > dataPingInterval) {
    console.log('Pinging companion');
    lastPinged = now;
    fetchCompanionData('wtf where is my file');
  }
}

setInterval(() => {
  checkNeedForPing();
}, 15000);

// Update the clock every tick event
clock.ontick = () => updateClock();

// Listen for the onerror event
messaging.peerSocket.onerror = function(err) {
  // Handle any errors
  console.log("Connection error: " + err.code + " - " + err.message);
};
