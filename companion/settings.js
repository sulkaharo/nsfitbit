import { settingsStorage } from "settings";

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

const _settings = {};

_settings.getSettingIndex = function getSettingIndex (key, defvalue) {

  const keyValue = settingsStorage.getItem(key);

  if (keyValue) {
    const parsed = JSON.parse(keyValue);
    if (parsed.selected) return parsed.selected[0];
    return defvalue;
  } else {
    return defvalue;
  }
}

function mapTruthy (value) {
  if (value == 'true') return true;
  if (value == 'false') return false;
  return value;
}

_settings.getSettings = function getSettings (key, defvalue) {

  const keyValue = settingsStorage.getItem(key);

  if (keyValue) {
    const parsed = JSON.parse(keyValue);
    if (parsed.values) {
      if (parsed.values[0].value) return mapTruthy(parsed.values[0].value);
      return mapTruthy(parsed.values[0].name);
    }
    if (parsed.name) return mapTruthy(parsed.name);
    return mapTruthy(parsed);
  } else {
    return defvalue;
  }
}

_settings.parseSettings = function parseSettings () {

  const settings = {};

  settings.units = settingsStorage.getItem('usemgdl') === 'true' ? 'mgdl' : 'mmol';

  settings.multicolor = _settings.getSettings('multicolor', false);

  // thresholds are always mgdl
  settings.highThreshold = Number(_settings.getSettings('highThreshold', 200));
  settings.lowThreshold = Number(_settings.getSettings('lowThreshold', 70));

  if (settings.units == 'mmol') {
    settings.highThreshold = mgdl(settings.highThreshold);
    settings.lowThreshold = mgdl(settings.lowThreshold);
  }

  settings.activity = _settings.getSettings('activity', false);
  settings.apiSecret = _settings.getSettings('apiSecret', false);

  const URLS = _settings.getURLS();

  settings.sgvURL = URLS[0];
  settings.treatmentURL = URLS[1];
  settings.pebbleURL = URLS[2];
  settings.profileURL = URLS[3];
  settings.v2APIURL = URLS[4];

  settings.timeFormat = '24h';

  settings.displayOn = _settings.getSettings('alwaysOn', false);
  settings.offOnNight = _settings.getSettings('offOnNight', false);
  settings.alarmsOffDuringNight = _settings.getSettings('alarmsOffDuringNight', false);

  settings.cgmHours = Number(_settings.getSettings('cgmHours', 3));
  settings.predictionHours = Number(_settings.getSettings('predictionHours', 0));

  if (typeof _settings.getSettings('endpoint', '') === 'object' && _settings.getSettings('endpoint', '') !== null || _settings.getSettings('endpoint', '') == ''){
    //workaround an odd fitbit bug where an empty textbox returns back an object
    //we presume if the textbox is empty that we are operating in offline mode
    settings.offline = true;
    //we have no pridictions in offline mode..... yet
    //so lets turn them off for now
    settings.predictionHours = 0;
    //console.log ("setting offline to true");
  }else{
    settings.offline = false;
    //console.log ("setting offline to false");
  }

  settings.enableAlarms = _settings.getSettings('enableAlarms', false);

  let predSteps = _settings.getSettingIndex('alarmPredictions', 0);
  if (predSteps.selected) {
    predSteps = predSteps.selected[0];
  }
  settings.predSteps = predSteps;

  settings.shownoise = _settings.getSettings('shownoise', false);

  settings.statusLine1 = _settings.getSettings('statusLine1', false);
  settings.statusLine2 = _settings.getSettings('statusLine2', false);

  settings.graphDynamicScale = _settings.getSettings('graphDynamicScale', false);

  const gt = _settings.getSettings('graphTopBG', settings.units == 'mmol' ? 10 : 180);
  settings.graphTopBG = settings.units == 'mmol' ? gt * 18 : gt;

  settings.staleAlarm = _settings.getSettings('staleAlarm', 0);

  settings.loggingEnabled = true;

  settings.alarmOffBody = !_settings.getSettings('alarmOffBody', false);;

  return settings;

}

_settings.getURLS = function getURLS () {
  let url = _settings.getSettings('endpoint', '');
  //default to the xDrip Local endpoint
  let protocol = 'http';
  let entryCount = 4 * 60 / 5;
  let server = '127.0.0.1:17580';
  let urls = {};
  let endpoints = [
      '/sgv.json?count=' + entryCount, //[0] = SGV endpoint
      '', // [1] = treatments endpoint
      '/pebble', // [2] pebble endpoint
      '', // [3] = profile endpoint
      '']; // [4] = V2 API endpoint

  //check if we have a nightscout url or not
  if (typeof url === 'string' || url instanceof String && url) {
    // eslint-disable-next-line no-useless-escape
    const parsed = url.match(/^(http|https|ftp)?(?:[\:\/]*)([a-z0-9\.-]*)(?:\:([0-9]+))?(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i);
    //Use HTTPS
    protocol = 'https';
    server = parsed[2].toLowerCase();
    //console.log ('server is: '+server);
    //Update SGV Endpont
    endpoints[0] = '/api/v1/entries.json?count=' + entryCount;
    //Update Treatments endpoint
    endpoints[1] = '/api/v1/treatments.json?count=120';
    //Update profile endpoint
    endpoints[3] = '/api/v1/profile.json?count=1';
    //Update V2 API endpoint
    endpoints[4] = '/api/v2/properties';
  }

  for (let i = 0; i <= 4; i++) {
    //check if the endpoint is not empty
    if (endpoints[i] != '') {
      urls[i] = protocol + "://" + server + endpoints[i];
    } else {
      //pass on a empty resource
      urls[i] = '';
    }
    //console.log('Endpoint '+i+' is '+protocol+"://"+server+endpoints[i]);
  }
  return urls;

}

let _updateCallback = null;

_settings.setCallback = function(cb) {
  _updateCallback = cb;
}

export default _settings;
