const ALARM_BG = 'BG';
const ALARM_PRED = 'PRED_BG';
const ALARM_STALE = 'STALE_DATA';

export default class Alarms {

  constructor(settings, ui) {
    this._activeAlarm = null;
    this._settings = settings;
    this._snoozes = {};
    ui.init(this);
    this._ui = ui;
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
    return false;
  }

  snooze(duration) {
    const a = this._activeAlarm;
    if (!a) {
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

  checkAlarms(entry, prevEntry, fileGenerationTime) {

    const sgv = entry.sgv;
    const displayGlucose = this._settings.units === "mgdl" ? sgv : Math.round((0.0556 * sgv) * 10) / 10;
    const generatedAlarms = [];

    const fileAge = Date.now() - fileGenerationTime;
    const deltaMins = Math.floor(fileAge / 1000 / 60);

    if (fileAge > 10*60*1000) {
      return [this.generateAlarm(
        ALARM_STALE
        , 'Last data update from phone ' + deltaMins + ' mins ago'
        , 'nudge')];
    }

    if (this._settings.staleAlarm > 0) {
      const staleMills = this._settings.staleAlarm * 60 * 1000;
      const delta = Date.now() - entry.date;
      const deltaMins = Math.floor(delta / 1000 / 60);

      if (delta > staleMills) {
        return [this.generateAlarm(
          ALARM_STALE
          , 'Last CGM reading ' + deltaMins + ' mins ago'
          , 'nudge')];
      }
    }

    let skipPredictedBG = false;

    if (sgv >= this._settings.highThreshold) {
      generatedAlarms.push(this.generateAlarm(
        ALARM_BG
        , 'HIGH BG: ' + displayGlucose
        , 'nudge'));
      skipPredictedBG = true;
    }

    if (sgv <= this._settings.lowThreshold) {
      generatedAlarms.push(this.generateAlarm(
        ALARM_BG
        , 'LOW BG: ' + displayGlucose
        , 'nudge'));
      skipPredictedBG = true;
    }

    if (!skipPredictedBG && this._settings.predSteps > 0) {

      // TODO assumes readings happens every 5 minutes

      let deltaDivisor = 1;

      if ((entry.date - prevEntry.date) > 10*60*1000) {
        deltaDivisor = Math.floor((entry.date - prevEntry.date) / (5*60*1000)) + 1;
      }

      // use interpolated delta when readings are missed
      const delta = (entry.sgv - prevEntry.sgv) / deltaDivisor;
      const pred = entry.sgv + delta * this._settings.predSteps;

      const displayPredGlucose = this._settings.units === "mgdl" ? pred : Math.round((0.0556 * pred) * 10) / 10;

      if (pred >= this._settings.highThreshold) {
        generatedAlarms.push(this.generateAlarm(
          ALARM_PRED
          , 'HIGH predicted: ' + displayPredGlucose
          , 'nudge'));
      }

      if (pred <= this._settings.lowThreshold) {
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
      this.removeSnooze(ALARM_BG);
    }

    const delta = entry.sgv - prevEntry.sgv;
    const pred = entry.sgv + delta * this._settings.predSteps;

    if (pred > this._settings.lowThreshold && pred < this._settings.highThreshold) {
      this.removeSnooze(ALARM_PRED);
    }

  }

  snoozeFilterAlarms(alarms) {
    const a = this;
    return alarms.filter(function isSnoozed (alarm) {
      return !a.isAlarmTypeSnoozed(alarm.type);
    });
  }

  checkAndAlarm(entry, prevEntry, settings, fileGenerationTime) {

    if (settings.loggingEnabled) console.log('Checking for alarms');

    this._settings = settings;

    if (!this._settings.enableAlarms) {
      return;
    }

    // check if we should clear snoozes 
    this.checkClearSnoozes(entry, prevEntry);

    const a = this.checkAlarms(entry, prevEntry, fileGenerationTime);
    const alarms = this.snoozeFilterAlarms(a);
    
    if (alarms.length > 0) {
      if (this._activeAlarm == null) {
        this._activeAlarm = alarms[0];
        if (settings.loggingEnabled) console.log('Showing alarm (new or unsnoozed)');
        this._ui.showAlert(this._activeAlarm.message, this._activeAlarm.vibration);
      }
    } else {
      this._activeAlarm = null;
      this._ui.hideAlerts();
    }
  }
}
