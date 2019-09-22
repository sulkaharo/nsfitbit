
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

_settings.getSettings = function getSettings(key, defvalue) {

  const keyValue = settingsStorage.getItem(key);

  if (keyValue) {
    console.log(key, 'value is', keyValue);
    const parsed = JSON.parse(keyValue);
    if (!parsed.name || parsed.name == "") return defvalue;
    return parsed.name;
  } else {
    console.log('Setting', key, 'not found, returning', defvalue);
    return defvalue;
  }
}

_settings.parseSettings = function parseSettings() {

  const settings = {};

  settings.units = settingsStorage.getItem('usemgdl') === 'true' ? 'mgdl' : 'mmol';

  // thresholds are always mgdl
  settings.highThreshold = Number(_settings.getSettings('highThreshold', 200));
  settings.lowThreshold = Number(_settings.getSettings('lowThreshold', 70));

  if (settings.units == 'mmol') {
    settings.highThreshold = mgdl(settings.highThreshold);
    settings.lowThreshold = mgdl(settings.lowThreshold);
  }

  settings.apiSecret = _settings.getSettings('apiSecret', false); // settingsStorage.getItem('apiSecret').name;

  const URLS = _settings.getURLS();

  settings.sgvURL = URLS.sgvURL;
  settings.treatmentURL = URLS.treatmentURL;

  settings.timeFormat = '24h';
  settings.bgColor = 'black';

  return settings;

}

_settings.getURLS = function getURLS() {
  let url = _settings.getSettings('endpoint', null);
  if (url) {
    // eslint-disable-next-line no-useless-escape
    const parsed = url.match(/^(http|https|ftp)?(?:[\:\/]*)([a-z0-9\.-]*)(?:\:([0-9]+))?(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i);
    const host = parsed[2] + '';
    const sgvURL = 'https://' + host.toLowerCase() + '/api/v1/entries.json?count=40';
    const treatmentURL = 'https://' + host.toLowerCase() + '/api/v1/treatments.json?count=20';
    console.log('Loading data from', sgvURL, treatmentURL);
    return {sgvURL, treatmentURL};
  } else {
    // Default xDrip web service 
    return "http://127.0.0.1:17580/sgv.json";
  }
}

export default _settings;

settingsStorage.onchange = function (evt) {
  console.log('Setting changed', evt.key, _settings.getSettings(evt.key));
  _settings.parseSettings();
  //updateDataFromCloud();
};
