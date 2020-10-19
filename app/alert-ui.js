import document from "document";
import { vibration } from "haptics";

const TEN_MINUTES = 1000 * 60 * 10;
const INDEFINITELY = 1000 * 60 * 1000;

const Icon_doubleup = document.getElementById("alert_doubleup");
const Icon_doubledown = document.getElementById("alert_doubledown");
const Icon_nodata = document.getElementById("alert_nodata");

export default class AlertUI {

  constructor() {
    this._myPopup = document.getElementById("popup");
    this._alertHeader = document.getElementById("alertHeader");
    this._btnLeft = this._myPopup.getElementById("btnLeft");
    this._btnRight = this._myPopup.getElementById("btnRight");
  }

  init(alarms) {

    this._alarms = alarms;
    const a = this;

    // eslint-disable-next-line no-unused-vars
    this._btnLeft.onclick = function(evt) {
      // Mute
      a.hideAlerts();
      a._alarms.snooze(INDEFINITELY);
    };

    // eslint-disable-next-line no-unused-vars
    this._btnRight.onclick = function(evt) {
      // Snooze
      a.hideAlerts();
      a._alarms.snooze(TEN_MINUTES);
    };
  }

  hideicons() {
    Icon_doubleup.style.visibility = 'hidden';
    Icon_doubledown.style.visibility = 'hidden';
    Icon_nodata.style.visibility = 'hidden';
  }

  showAlert(message, vibrationtype, icon) {
    console.log('ALERT BG message: ' + message);
    // todo add vibration cancelling

    this.hideicons();

    if (icon) {
      const i = document.getElementById("alert_" + icon);
      if (i) {
        i.style.visibility = 'visible';
      }
    }

    vibration.start(vibrationtype);
    this._alertHeader.text = message;
    this._myPopup.style.display = "inline";
  }

  hideAlerts() {
    vibration.stop();
    this._myPopup.style.display = "none";
  }

}
