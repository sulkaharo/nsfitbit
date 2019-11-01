
const ALARM_BG = 'BG';
const ALARM_PRED = 'PRED_BG';

export default class Alarms {

  constructor(settings, ui) {
    this._activeAlarm = null;
    this._settings = settings;
    this._snoozes = {};
    ui.init(this);
    this._ui = ui;
  }

  setSettings(settings) {
    this._settings = settings;
  }

  removeSnooze(type) {
    delete this._snoozes[type];
  }

  isAlarmTypeSnoozed(type) {
    if (this._snoozes[type]) {
      if (this._snoozes[type] < Date.now()) {
        this.removeSnooze(type);
      } else {
        return true;
      }
    }
    console.log('Alarm not snoozed', type);
    return false;
  }

  snooze(duration) {
    const a = this._activeAlarm;
    console.log("Snoozing", a.type, duration);
    if (!a) {
      console.log('No active alarm?');
      return;
    }
    this._snoozes[a.type] = Date.now() + duration;
    this._activeAlarm = null;
  }

  generateAlarm(type, message, vibration) {
    return {
      type
      , message
      , vibration
    };
  }

  checkAlarms(entry, prevEntry) {

    console.log('Checking for alarms');

    if (!this._settings.enableAlarms) {
      return;
    }

    const sgv = entry.sgv;
    const displayGlucose = this._settings.units === "mgdl" ? sgv : Math.round((0.0556 * sgv) * 10) / 10;
    const generatedAlarms = [];

    let skipPredictedBG = false;

    if (sgv >= this._settings.highThreshold) {
      console.log('BG HIGH, triggering alarm');
      generatedAlarms.push(this.generateAlarm(
        ALARM_BG
        , 'HIGH BG: ' + displayGlucose
        , 'nudge'));
      skipPredictedBG = true;
    }

    if (sgv <= this._settings.lowThreshold) {
      console.log('BG LOW, triggering alarm');
      generatedAlarms.push(this.generateAlarm(
        ALARM_BG
        , 'LOW BG: ' + displayGlucose
        , 'nudge'));
      skipPredictedBG = true;
    }

    if (!skipPredictedBG && this._settings.predSteps > 0) {

      const delta = entry.sgv - prevEntry.sgv;
      const pred = entry.sgv + delta * this._settings.predSteps;

      const displayPredGlucose = this._settings.units === "mgdl" ? pred : Math.round((0.0556 * pred) * 10) / 10;

      console.log("Predicted BG is " + displayPredGlucose);

      if (pred >= this._settings.highThreshold) {
        console.log('PRED BG HIGH, triggering alarm');
        generatedAlarms.push(this.generateAlarm(
          ALARM_PRED
          , 'HIGH predicted: ' + displayPredGlucose
          , 'nudge'));
      }

      if (pred <= this._settings.lowThreshold) {
        console.log('PRED BG LOW, triggering alarm');
        generatedAlarms.push(this.generateAlarm(
          ALARM_PRED
          , 'LOW predicted: ' + displayPredGlucose
          , 'nudge'));
      }
    }

    return generatedAlarms;
  }

  checkClearSnoozes(entry, prevEntry) {
    const sgv = entry.sgv;
    if (sgv > this._settings.lowThreshold && sgv < this._settings.highThreshold) {
      console.log('BG normal, removing snooze');
      this.removeSnooze(ALARM_BG);
    }

    const delta = entry.sgv - prevEntry.sgv;
    const pred = entry.sgv + delta * this._settings.predSteps;

    if (pred > this._settings.lowThreshold && pred < this._settings.highThreshold) {
      console.log('BG PRED normal, removing snooze');
      this.removeSnooze(ALARM_PRED);
    }

  }

  snoozeFilterAlarms(alarms) {
    const a = this;
    return alarms.filter(function isSnoozed(alarm) {
      return !a.isAlarmTypeSnoozed(alarm.type);
    });
  }

  checkAndAlarm(entry, prevEntry) {

    // check if we should clear snoozes 
    this.checkClearSnoozes(entry, prevEntry);

    const a = this.checkAlarms(entry, prevEntry);
    const alarms = this.snoozeFilterAlarms(a);

    if (alarms.length > 0) {
      this._activeAlarm = alarms[0];
      console.log('Showing alarm (new or unsnoozed)');
      this._ui.showAlert(this._activeAlarm.message, this._activeAlarm.vibration);
    } else {
      this._activeAlarm = null;
      this._ui.hideAlerts();
    }
  }
}
