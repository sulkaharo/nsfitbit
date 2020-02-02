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
import { memory } from "system";
import { me as device } from "device";

if (!device.screen) device.screen = { width: 348, height: 250 };

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

const UI_time = document.getElementById('clock');
const UI_statusLine1 = document.getElementById('statusline1');
const UI_statusLine2 = document.getElementById('statusline2');
const UI_steps = document.getElementById("steps");
const UI_stepsicon = document.getElementById("stepsicon");
const UI_hrLabel = document.getElementById('heartrate');
const UI_hricon = document.getElementById('hricon');
const UI_batteryLabel = document.getElementById('battery');
const UI_noDataWarning = document.getElementById('noData');
const UI_sgv = document.getElementById("sgv");
const UI_dirArrow = document.getElementById("dirArrow");
const UI_noise = document.getElementById("noise");
const UI_delta = document.getElementById("delta");
const UI_age = document.getElementById("age");
const UI_docGraph = document.getElementById("docGraph");

UI_hrLabel.text = "--";
UI_steps.text = "--";

let lastGlucoseDate = 0;

UI_docGraph.height = Math.round(0.4*device.screen.height);
UI_docGraph.width = device.screen.width;
let myGraph = new Graph(UI_docGraph);

var settings = {};

const alarmsUI = new AlarmUI();
const alarms = new Alarms(settings, alarmsUI);

function debug () {
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
  const n = noise || 0;
  switch (parseInt(n)) {
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
    UI_hrLabel.text = hrm.heartRate;
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

    const direction = data.direction || 'None';

    UI_sgv.text = settings.units == 'mgdl' ? data.sgv + "" + arrowIcon[direction] : mmol(data.sgv) + "" + arrowIcon[direction];
    UI_sgv.style.fill = coloralloc(data.sgv, settings.lowThreshold, settings.highThreshold, settings.multicolor);

    lastGlucoseDate = data.date;

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

    UI_delta.text = deltaString;

    //update noise
    //blank the value just encase the value was turned on then off
    UI_noise.text = '';
    if (settings.shownoise && data.noise) {
      UI_noise.text = noiseCodeToDisplay(data.sgv, data.noise);
    }

    updateClock();

  } else {
    UI_sgv.text = '--';
    UI_sgv.style.fill = 'red';
    UI_dirArrow.text = '';
    UI_dirArrow.style.fill = "red";
  }
}

// Event occurs when new file(s) are received
inbox.onnewfile = () => {
  let fileName;
  let runUpdate = false;

  if (debug()) console.log('Inbox says there is a file');
  do {
    // If there is a file, move it from staging into the application folder
    fileName = inbox.nextFile();
    if (fileName) runUpdate = true; // This is sometimes called with undefined files?!?
    if (debug()) console.log('Clearing the queue of: ' + fileName);
  } while (fileName);

  if (debug() && !runUpdate) console.log('Skipping update as there were no real files');

  // Now update the data
  // TODO: Refactor to read settings and data separately
  if (runUpdate) readSGVFile(true);
};

let latestGlucoseDate = 0;

function readFile (filename) {
  try {
    return fs.readFileSync(filename, 'cbor');
  } catch (e) {
    if (debug()) console.log('File read failed');
    return false;
  }
}

var lastSmallUpdate = 0;
var lastBigUpdate = 0;

const FIFTEEN_SECONDS = 15 * 1000;
const ONE_MINUTE = 60 * 1000;

function readSGVFile (fileIsNew) {

  if (debug() && fileIsNew) console.log('File is new, running full update');

  const runSmallUpdate = fileIsNew || Date.now() - lastSmallUpdate > FIFTEEN_SECONDS;
  const runBigUpdate = fileIsNew || Date.now() - lastBigUpdate > ONE_MINUTE;

  // SMALL UPDATE
  // Only do less CPU intensive work here

  if (!runSmallUpdate) { return; }
  if (debug()) console.log('Running small update');
  lastSmallUpdate = Date.now();

  if (debug()) console.log("JS memory: " + memory.js.used + " used of " + memory.js.total);

  let data = readFile('data.cbor');
  settings = readFile('settings.cbor');

  //check if the any data exists first
  if (!data || !settings) return;
  //check if empty data strings are being sent
  if (data.state === undefined || data.state.length == 0) return;
  // We got data, hide the warning
  UI_noDataWarning.style.display = 'none';

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
    if (debug()) console.log("The Icon visibility: " + UI_stepsicon.style.visibility);
    //reduce the amount of interactions with the DOM by checking the visibility and only if false then set item
    if (UI_stepsicon.style.visibility != "visible") {
      UI_stepsicon.style.visibility = "visible";
      UI_steps.style.visibility = "visible";
      UI_hrLabel.style.visibility = "visible";
      UI_hricon.style.visibility = "visible";
    }
    //Update the amount of steps
    UI_steps.text = today.local.steps || 0;
  } else {
    if (UI_stepsicon.style.visibility == "visible") {
      UI_stepsicon.style.visibility = "hidden";
      UI_steps.style.visibility = "hidden";
      UI_hrLabel.style.visibility = "hidden";
      UI_hricon.style.visibility = "hidden";
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

  UI_statusLine1.text = statusStrings[s1] || "";
  UI_statusLine2.text = statusStrings[s2] || "";

  // LARGE UPDATE
  // CPU intensive work is done less frequently

  if (!runBigUpdate) { return; }
  if (debug()) console.log('Running big update');
  lastBigUpdate = Date.now();

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

// The updater is used to update the screen every 1 minute
function updateClock () {

  if (debug()) console.log('Clock update: ' + Date.now());

  const nowDate = new Date();
  const hours = nowDate.getHours();
  const mins = nowDate.getMinutes();
  const month = monthNames[nowDate.getMonth()];
  const day = nowDate.getDate();

  if (mins < 10) { mins = `0${mins}`; }

  const dateText = `${month} ${day} `;

  const ampm = hours < 12 ? "AM" : "PM";

  if (preferences.clockDisplay === "12h") {
    UI_time.text = dateText + `${hours%12 ? hours%12 : 12}:${mins} ${ampm}`;
  } else {
    UI_time.text = dateText + `${hours}:${mins}`;
  }

  UI_batteryLabel.text = Math.floor(battery.chargeLevel) + "%";

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

  let minsAgo = Math.round((Date.now() - lastGlucoseDate) / 60000);
  UI_age.style.fill = 'green';

  if (minsAgo > 15) {
    UI_sgv.text = '--';
    UI_delta.text = '--';
    UI_noise.text = '';
    UI_sgv.style.fill = 'red';
    UI_age.style.fill = 'red';
  }

  UI_age.text = minsAgo > 30 ? ">30 mins ago" : `${minsAgo} mins ago`;

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
  readSGVFile(false);
}, 5000);

readSGVFile(true);

clock.granularity = "minutes";
clock.ontick = () => updateClock();

// Listen for the onerror event
messaging.peerSocket.onerror = function(err) {
  // Handle any errors
  if (debug()) console.log("Connection error: " + err.code + " - " + err.message);
};
