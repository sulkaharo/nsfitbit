// Imports
import { display } from "display";
import clock from "clock";
import * as messaging from "messaging";
import document from "document";
import { inbox } from "file-transfer";
import * as fs from "fs";
import { preferences } from "user-settings";
import { today } from "user-activity";
import { HeartRateSensor } from "heart-rate";
import { battery } from "power";
import { coloralloc } from "./functions.js";
import Graph from "./graph.js";
import Alarms from "./alarms.js";
import AlarmUI from "./alert-ui.js";

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

let lastUpdateTime = 0;

const time = document.getElementById('clock');

const statusLine1 = document.getElementById('statusline1');
const statusLine2 = document.getElementById('statusline2');

const steps = document.getElementById("steps");
const stepsicon = document.getElementById("stepsicon");
const hrLabel = document.getElementById('heartrate');
const hricon = document.getElementById('hricon');
const batteryLabel = document.getElementById('battery');

const noDataWarning = document.getElementById('noData');

hrLabel.text = "--";
steps.text = "--";

const sgv = document.getElementById("sgv");
const dirArrow = document.getElementById("dirArrow");

const noise = document.getElementById("noise");

const delta = document.getElementById("delta");
const age = document.getElementById("age");

const docGraph = document.getElementById("docGraph");
let myGraph = new Graph(docGraph);

var settings = {};

const alarmsUI = new AlarmUI();
const alarms = new Alarms(settings, alarmsUI);

function debug() {
  return settings.loggingEnabled;
}

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

//convert a noise number to text
function noiseCodeToDisplay (mgdl, noise) {
  var display;
  switch (parseInt(noise)) {
    case 0:
      display = '---';
      break;
    case 1:
      display = 'Clean';
      break;
    case 2:
      display = 'Light';
      break;
    case 3:
      display = 'Medium';
      break;
    case 4:
      display = 'Heavy';
      break;
    default:
      if (mgdl < 40) {
        display = translate('Heavy');
      } else {
        display = '~~~';
      }
      break;
  }
  return display;
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
    hrLabel.text = hrm.heartRate;
  }
  hrmLastUpdated = now;
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
    if (debug()) console.log('Watch pinging the companion');
    messaging.peerSocket.send({
      command: cmd
    });
  }
}

// Display the data received from the companion
function updateScreenWithLatestGlucose (data, prevEntry) {
  if (debug()) console.log("bg is: " + JSON.stringify(data));

  if (data) {

    //hand off to colour threshold function to allocate the color
    sgv.text = settings.units == 'mgdl' ? data.sgv + "" + arrowIcon[data.direction] : mmol(data.sgv) + "" + arrowIcon[data.direction];
    sgv.style.fill = coloralloc(data.sgv, settings.lowThreshold, settings.highThreshold, settings.multicolor);

    //dirArrow.text = arrowIcon[data.direction];
    //dirArrow.style.fill = tcolor;

    minsAgo = data.date;
    minsAgoText = Math.round((Date.now() - minsAgo) / 60000);
    age.text = `${minsAgoText} mins ago`;

    // calc the delta

    let deltaString = "";
    let deltaValue = 0;

    if (settings.units == 'mgdl') {
      deltaValue = data.sgv - prevEntry.sgv;
      deltaString = deltaValue + ' mgdl';
    } else {
      // mmmol needs to be calculated from pre-rounded values to ensure the delta makes sense
      const p = Math.round((0.0556 * prevEntry.sgv) * 10) / 10;
      const n = Math.round((0.0556 * data.sgv) * 10) / 10;
      deltaValue = n - p;
      deltaString = deltaValue.toFixed(1) + ' mmol';
    }

    if (deltaValue > 0) {
      deltaString = '+' + deltaString;
    }

    delta.text = deltaString;

    //update noise
    //blank the value just encase the value was turned on then off
    noise.text = '';
    if (settings.shownoise) {
      noise.text = noiseCodeToDisplay(data.sgv, data.noise);
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

let latestGlucoseDate = 0;

function readSGVFile (filename) {

  let data;

  try {
    data = fs.readFileSync(filename, 'cbor');
  } catch (e) {
    if (debug()) console.log('File read failed');
    return;
  }
  if (!data.BGD) return;

  // We got data, hide the warning
  noDataWarning.style.display = 'none';

  settings = data.settings;

  const hour = new Date().getHours();
  const nightTimeOff = (hour >= 22 || hour <= 7) && settings.offOnNight;

  if (settings.displayOn && !nightTimeOff) {
    display.autoOff = false;
    display.on = true;
  } else {
    display.autoOff = true;
  }

  //Steps Icon and HR
  if (settings.activity) {
    if (debug()) console.log("The Icon visibility: " + stepsicon.style.visibility);
    //reduce the amount of interactions with the DOM by checking the visibility and only if false then set item
    if (stepsicon.style.visibility != "visible") {
      stepsicon.style.visibility = "visible";
      steps.style.visibility = "visible";
      hrLabel.style.visibility = "visible";
      hricon.style.visibility = "visible";
    }
    //Update the amount of steps
    steps.text = today.local.steps || 0;
  } else {
    if (stepsicon.style.visibility == "visible") {
      stepsicon.style.visibility = "hidden";
      steps.style.visibility = "hidden";
      hrLabel.style.visibility = "hidden";
      hricon.style.visibility = "hidden";
    }
  }

  const recentEntry = data.BGD[0];

  alarms.checkAndAlarm(recentEntry, data.BGD[1], settings, data.meta.phoneGenerationTime);

  updateScreenWithLatestGlucose(recentEntry, data.BGD[1]);
  latestGlucoseDate = recentEntry.date;

  const statusStrings = {};

  const state = data.state;

  statusStrings["IOB"] = state.iob ? "IOB " + state.iob : "IOB ???";
  statusStrings["COB"] = state.iob ? "COB " + state.cob : "COB ???";
  statusStrings["BWP"] = state.iob ? "BWP " + state.bwp : "BWP ???";

  const s1 = settings.statusLine1 || "IOB";
  const s2 = settings.statusLine2 || "COB";

  statusLine1.text = statusStrings[s1] || "";
  statusLine2.text = statusStrings[s2] || "";

  const state = data.state;

  // Update the graph
  myGraph.update(data, settings);

  if (data.boluses) {
    myGraph.updateTreatments(data.boluses, settings);
  }
  if (data.basals) {
    myGraph.updateBasals(data.basals, settings);
  }
}

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

  batteryLabel.text = Math.floor(battery.chargeLevel) + "%";

  // battery icon

  let b = 0;
  if (battery.chargeLevel > 25) b = 1;
  if (battery.chargeLevel > 50) b = 2;
  if (battery.chargeLevel > 75) b = 3;
  if (battery.chargeLevel > 90) b = 4;

  for (let i = 0; i < 5; i++) {
    const bImage = document.getElementById('b' + i);
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
    if (debug()) console.log('Periodic display update');
    readSGVFile('file.txt');
  }

}

// Have clock ping the Compantion to keep it alive

messaging.peerSocket.onopen = function() {
  if (debug()) console.log("Socket Open");
};

const dataPingInterval = 5 * 60 * 1000;
let lastPinged = 0;

function checkNeedForPing () {
  const now = Date.now();
  const timeSinceLastGlucose = now - latestGlucoseDate;
  const lastPingDelta = now - lastPinged;

  if (lastPingDelta > 30 * 1000 && timeSinceLastGlucose > dataPingInterval) {
    if (debug()) console.log('Pinging companion');
    lastPinged = now;
    fetchCompanionData('hey where is my file');
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
  if (debug()) console.log("Connection error: " + err.code + " - " + err.message);
};
