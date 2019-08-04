// Imports
import clock from "clock";
import * as messaging from "messaging";
import document from "document";
import { inbox } from "file-transfer";
import * as fs from "fs";
import { vibration } from "haptics";
import { preferences } from "user-settings";
import { today } from "user-activity";
import { HeartRateSensor } from "heart-rate";

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
let showAlertModal = true;

let lastUpdateTime = 0;
let muted = false;
let snoozeTimer = Date.now();
let alarming = false;

// Handles to GUI Elements
let time = document.getElementById("time");
let steps = document.getElementById("steps");
let hrLabel = document.getElementById("heartrate");

hrLabel.text = "--";
steps.text = "--";

let sgv = document.getElementById("sgv");
let dirArrow = document.getElementById("dirArrow");

let delta = document.getElementById("delta");
let age = document.getElementById("age");

let scale1 = document.getElementById("scale1");
let scale2 = document.getElementById("scale2");
let scale3 = document.getElementById("scale3");
let scale4 = document.getElementById("scale4");

let docGraph = document.getElementById("docGraph");
let myGraph = new Graph(docGraph);

var settings = {};

// converts a mg/dL to mmoL
function mmol (bg) {
  let mmolBG = Math.round((0.0556 * bg) * 10) / 10;
  return mmolBG;
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

// Declare a even handler that will be called every time a new HR value is received.
hrm.onreading = function() {
  // Peek the current sensor values
  console.log("Current heart rate: " + hrm.heartRate);
  hrLabel.text = hrm.heartRate;
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

    sgv.text = settings.units == 'mgdl' ? data.sgv : mmol(data.sgv);
    sgv.style.fill = tcolor;

    dirArrow.text = arrowIcon[data.direction];
    dirArrow.style.fill = tcolor;

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
    // call function every 10 or 15 mins to check again and see if the data is there   
    //setTimeout(fiveMinUpdater, 900000)    
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

function readSGVFile (filename) {

  // TODO: have a view that shows no data exists
  // Also WOOOT why is fileExists() not supported?

  let data;

  try {
    data = fs.readFileSync(filename, 'cbor');
  } catch (e) {
    console.log('File read failed');
    return;
  }

  if (!data.BGD) return;

  settings = data.settings;

  if (settings.units == 'mmol') {
    settings.highThreshold = mgdl(settings.highThreshold);
    settings.lowThreshold = mgdl(settings.lowThreshold);
  }

  let lastEntry = data.BGD[data.BGD.length - 1];

  checkAlarms(lastEntry);
  updateScreenWithLatestGlucose(lastEntry);

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

  // Set the graph scale
  myGraph.setYRange(ymin, ymax);
  // Update the graph
  myGraph.update(data.BGD, settings.highThreshold, settings.lowThreshold);

}

function checkAlarms (entry) {

  var displayGlucose = entry.sgv; //settings.units === "mgdl" ? entry.sgv : mmol(entry.sgv);

  if (displayGlucose < settings.highThreshold && displayGlucose > settings.lowThreshold) {
    stopVibration();
    muted = false;
    snoozeTimer = Date.now();
    alarming = false;
  }

  if (alarming) return;
  if (muted) return;
  if (snoozeTimer > Date.now()) return;

  if (displayGlucose >= settings.highThreshold) {
    console.log('BG HIGH');
    startVibration("nudge", 3000, displayGlucose);
  }

  if (displayGlucose <= settings.lowThreshold) {
    console.log('BG LOW');
    startVibration("nudge", 3000, displayGlucose);
  }
}

//----------------------------------------------------------
//
// Deals with Vibrations 
//
//----------------------------------------------------------
let vibrationTimeout;

function startVibration (type, length, message) {
  alarming = true;
  showAlert(message);
  vibration.start(type);
  /*if (length) {
    vibrationTimeout = setTimeout(function() {
      startVibration(type, length, message);
    }, length);
  }*/
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
}

// eslint-disable-next-line no-unused-vars
btnRight.onclick = function(evt) {
  console.log("Snooze");
  myPopup.style.display = "none";
  snoozeTimer = Date.now() + 1000*60*10;
  stopVibration();
}

// The updater is used to update the screen every 1 SECONDS 
function updateClock () {

  let nowDate = new Date();
  let hours = nowDate.getHours();
  let mins = nowDate.getMinutes();

  if (mins < 10) { mins = `0${mins}`; }

  let ampm = hours < 12 ? "AM" : "PM";

  if (preferences.clockDisplay === "12h") {
    time.text = `${hours%12 ? hours%12 : 12}:${mins} ${ampm}`;
  } else {
    time.text = `${hours}:${mins}`;
  }

  steps.text = today.local.steps || 0;

  // Update mins ago
  if (minsAgo > 0) {
    minsAgoText = Math.round((Date.now() - minsAgo) / 60000);
    age.text = `${minsAgoText} mins ago`;
    age.style.fill = 'green';
    if (minsAgoText > 10) age.style.fill = 'red';
  }

  // Update from file if ...

  let nowMoment = nowDate.getTime();
  let timeDelta = nowMoment - lastUpdateTime;

  if (timeDelta > (1000 * 5)) {
    readSGVFile('file.txt');
  }

}

// Listen for the onopen event - THIS NEVER SEEMS TO FIRE!!
messaging.peerSocket.onopen = function() {
  console.log("Socket Open");
  fetchCompanionData();
};

// Update the clock every tick event
clock.ontick = () => updateClock();

// Listen for the onerror event
messaging.peerSocket.onerror = function(err) {
  // Handle any errors
  console.log("Connection error: " + err.code + " - " + err.message);
};
