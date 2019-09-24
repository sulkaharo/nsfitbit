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
    this._basals = this._id.getElementsByClassName("basal");

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

  getRenderCoords(settings) {
    const totalMinutes = (settings.cgmHours + settings.predictionHours) * 60;
    const graphWidth = this._id.width;
    const fiveMinWidth = graphWidth / (totalMinutes/5);
    const zeroPoint = graphWidth * (settings.cgmHours / (settings.cgmHours + settings.predictionHours));
    return {fiveMinWidth, zeroPoint};
  }

  updateBasals(basals, settings) {
    console.log('Updating basals');
    const now = Date.now();

    const {fiveMinWidth, zeroPoint} = this.getRenderCoords(settings);

    for (let i = 0; i < this._basals.length; i++) {
      this._basals[i].style.visibility = 'hidden';
    }

    let totalWidth = 0;
    let maxVal = 0;

    for (let i = 0; i < basals.length; i++) {
      const b = basals[i];
      if (!b.absolute) continue;
      const abs = Number(b.absolute);
      if (abs > maxVal) maxVal = abs;
    }

    for (let i = 0; i < basals.length; i++) {
      if (!this._basals[i]) continue;

      const bar = this._basals[i];
      const b = basals[i];

      const d = b.duration / (5 * 60 * 1000);
      
      bar.width = (fiveMinWidth * d);
      bar.x = this._id.width - totalWidth;

      totalWidth += bar.width;
      if (totalWidth >= this._id.width) break;
      bar.style.visibility = 'visible';
      if (bar.x < 36) bar.style.visibility = 'hidden';

      const abs = Number(b.absolute) || 0;

      bar.height = 30 * Math.max(0,(abs / maxVal));

      bar.y = this._id.height - bar.height;

    }

  }

  updateTreatments(treatments, settings) {
    console.log("Updating treatment bars...");

    const now = Date.now();

    const {fiveMinWidth, zeroPoint} = this.getRenderCoords(settings);

    for (let i = 0; i < this._treatments.length; i++) {
      this._treatments[i].style.visibility = 'hidden';
    }

    for (let i = 0; i < treatments.length; i++) {
      if (!this._treatments[i]) continue;
      const bar = this._treatments[i];
      const t = treatments[i];
      const timeDelta = (now - t.date) / (5 * 60 * 1000);

      bar.x = this._id.width - (fiveMinWidth * timeDelta);

      if (t.carbs) {
        bar.height = 10 + (t.carbs / 2);
        bar.style.fill = 'green';
      }
      if (t.insulin) {
        bar.height = 10 + (t.insulin * 5);
        bar.style.fill = 'red';
      }
      bar.y = this._id.height - bar.height -30;
      bar.style.visibility = 'visible';

      if (bar.x < 36) bar.style.visibility = 'hidden';

    }

  }

  update(v, settings) {

    console.log("Updating glucose dots...");

    const {fiveMinWidth, zeroPoint} = this.getRenderCoords(settings);

    for (let i = 0; i < this._vals.length; i++) {
      this._vals[i].style.visibility = 'hidden';
    }

    const now = Date.now();
    const glucoseHeight = 100;

    for (let i = 0; i < v.length; i++) {
      if (!this._vals[i]) continue;
      const dot = this._vals[i];
      const sgv = v[i];

      const timeDeltaMinutes = (now - sgv.date) / (60 * 1000);
      if (timeDelta > settings.cgmHours*60) continue;

      const timeDelta = timeDeltaMinutes / 5;
      dot.cy =  Math.floor(glucoseHeight - ((sgv.sgv - this._ymin) / this._yscale));
      dot.cx = Math.floor(this._id.width - (timeDelta * fiveMinWidth));

      dot.style.fill = 'green';
      if (sgv.sgv >= settings.highThreshold || sgv.sgv <= settings.lowThreshold) {
        dot.style.fill = 'red';
      }
      dot.style.visibility = 'visible';

    }

    /*
    this._tHighLine.y1 = this._id.height - ((this._tHigh - this._ymin) / this._yscale);
    this._tHighLine.y2 = this._id.height - ((this._tHigh - this._ymin) / this._yscale);
    this._tLowLine.y1 = this._id.height - ((this._tLow - this._ymin) / this._yscale);
    this._tLowLine.y2 = this._id.height - ((this._tLow - this._ymin) / this._yscale);

    */

  }
};