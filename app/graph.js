import { me as device } from "device";

// Screen dimension fallback for older firmware
if (!device.screen) device.screen = {
  width: 348,
  height: 250
};

export default class Graph {

  constructor(id) {

    this._id = id;
    this._xscale = 0;
    this._yscale = 0;
    this._xmin = 0;
    this._xmax = 0;
    this._ymin = 0;
    this._ymax = 0;
    this._pointsize = 2;

    this._bg = this._id.getElementById("bg");

    this._vals = this._id.getElementsByClassName("gval");
    this._treatments = this._id.getElementsByClassName("treatment");
    
    this._tHigh = 162;
    this._tLow = 72;

    this._tHighLine = this._id.getElementById("tHigh");
    this._tLowLine = this._id.getElementById("tLow");

    this._defaultYmin = 40;
    this._defaultYmax = 400;

  }

  setPosition(x, y) {
    this._id.x = x;
    this._id.y = y;
  }

  setSize(w, h) {
    this._width = w;
    this._height = h;
  }

  setXRange(xmin, xmax) {
    this._xmin = xmin;
    this._xmax = xmax;
    this._xscale = (xmax - xmin) / this._width;
    //console.log("XSCALE: " + this._xscale);
  }

  setYRange(ymin, ymax) {

    this._ymin = ymin;
    this._ymax = ymax;
    this._yscale = (ymax - ymin) / this._id.height;
    //console.log("YSCALE: " + this._yscale);
  }

  getYmin() {
    return this._ymin;
  }

  getYmax() {
    return this._ymax;
  }

  setBGColor(c) {
    this._bgcolor = c;
    this._bg.style.fill = c;
  }

  updateTreatments(treatments) {
    console.log("Updating treatment bars...");

    const now = Date.now();

    for (let i = 0; i < this._treatments.length; i++) {
      this._treatments[i].style.visibility = 'hidden';
    }

    for (let i = 0; i < treatments.length; i++) {
      if (!this._treatments[i]) continue;
      const bar = this._treatments[i];
      const t = treatments[i];
      const timeDelta = (now - t.date) / (5 * 60 * 1000);

      bar.x = this._id.width - ((this._id.width / 24) * timeDelta);

      if (t.carbs) {
        bar.height = 10 + (t.carbs / 2);
        bar.style.fill = 'green';
      }
      if (t.insulin) {
        bar.height = 10 + (t.insulin * 5);
        bar.style.fill = 'red';
      }
      bar.y = this._id.height - bar.height;
      bar.style.visibility = 'visible';

      if (bar.x < 36) bar.style.visibility = 'hidden';

    }

  }

  update(v, highThreshold, lowThreshold) {

    console.log("Updating glucose dots...");

    //this._bg.style.fill = this._bgcolor;

    this._tHighLine.y1 = this._id.height - ((this._tHigh - this._ymin) / this._yscale);
    this._tHighLine.y2 = this._id.height - ((this._tHigh - this._ymin) / this._yscale);
    this._tLowLine.y1 = this._id.height - ((this._tLow - this._ymin) / this._yscale);
    this._tLowLine.y2 = this._id.height - ((this._tLow - this._ymin) / this._yscale);

    // 24 points total
    // 120 minutes

    for (let index = 0; index < this._vals.length; index++) {

      //console.log(`V${index}: ${v[index].sgv}`);
      //console.log(this._vals[index]);

      //console.log("SGV" + index + ": " + v[index].sgv + " TIME: " + v[index].date);
      //this._vals[index].cx = this._width - ((v[index].date-this._xmin) / this._xscale);

      if (!v[index]) continue;

      let graphEntry = this._vals[index];

      let sgv = v[index];

      let timeDeltaMinutes = sgv.timedelta / (5 * 60 * 1000);

      graphEntry.cy = this._id.height - ((sgv.sgv - this._ymin) / this._yscale);
      // console.log('sgv.timedelta: ' + sgv.timedelta + 'sgv is ' + sgv.sgv);
      // console.log('cx is: ' + graphEntry.cx + ' and setting it to '+ (this._id.width / 24) * timeDeltaMinutes);
      const padding = this._id.width / 48;

      graphEntry.cx = this._id.width - ((this._id.width / 24) * timeDeltaMinutes) - padding;

      graphEntry.style.fill = 'green';
      if (sgv.sgv >= highThreshold || sgv.sgv <= lowThreshold) {
        graphEntry.style.fill = 'red';
      }

      //this._vals[index].cy = this._height - 20;
      //this._vals[index].r = this._pointsize;

    }
  }
};