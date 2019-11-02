
import { settingsStorage } from "settings";

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

const _settings = {};

_settings.getSettingIndex = function getSettingIndex(key, defvalue) {

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

_settings.getSettings = function getSettings(key, defvalue) {

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

_settings.parseSettings = function parseSettings() {

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
  settings.apiSecret = _settings.getSettings('apiSecret', false); // settingsStorage.getItem('apiSecret').name;

  const URLS = _settings.getURLS();

  settings.sgvURL = URLS.sgvURL;
  settings.treatmentURL = URLS.treatmentURL;
  settings.pebbleURL = URLS.pebbleURL;
  settings.profileURL = URLS.profileURL;
  settings.v2APIURL = URLS.v2APIURL;

  settings.timeFormat = '24h';
  settings.bgColor = 'black';

  settings.displayOn = _settings.getSettings('alwaysOn', false);
  settings.offOnNight = _settings.getSettings('offOnNight', false);

  settings.cgmHours = Number(_settings.getSettings('cgmHours', 3));
  settings.predictionHours =  Number(_settings.getSettings('predictionHours', 0));

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

  const gt = _settings.getSettings('graphTopBG', settings.units == 'mmol' ? 10: 180);
  settings.graphTopBG = settings.units == 'mmol' ? gt * 18 : gt;

  settings.staleAlarm = _settings.getSettings('staleAlarm', 0);

  settings.loggingEnabled = false;

  return settings;

}

_settings.getURLS = function getURLS() {
  let url = _settings.getSettings('endpoint', null);
  if (url) {
    // eslint-disable-next-line no-useless-escape
    const parsed = url.match(/^(http|https|ftp)?(?:[\:\/]*)([a-z0-9\.-]*)(?:\:([0-9]+))?(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i);
    const host = parsed[2] + '';
    const start = 'https://' + host.toLowerCase();

    const entryCount = 4*60/5;
    const sgvURL = start + '/api/v1/entries.json?count=' + entryCount;
    const treatmentURL = start + '/api/v1/treatments.json?count=150';
    const pebbleURL = start + '/pebble';
    const profileURL = start + '/api/v1/profile.json';
    const v2APIURL = start + '/api/v2/properties';

    return {sgvURL, treatmentURL, pebbleURL, profileURL, v2APIURL};
  } else {
    // Default xDrip web service
    return "http://127.0.0.1:17580/sgv.json";
  }
}

let _updateCallback = null;

_settings.setCallback = function(cb) {
  _updateCallback = cb;
}

export default _settings;
