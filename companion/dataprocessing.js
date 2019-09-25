
const dataProcessor = {};


function _basalsFromProfile(profile) {
  if (profile.length && profile[0]['basal']) {
    return profile[0]['basal'];
  } else if (profile.length && profile[0]['defaultProfile']) {
    return profile[0]['store'][profile[0]['defaultProfile']]['basal'];
  } else {
    return [];
  }
}

function _hhmmAfter(hhmm, mills) {
  var date = new Date(mills);
  var withSameDate = new Date(
    1900 + date.getYear(),
    date.getMonth(),
    date.getDate(),
    parseInt(hhmm.substr(0, 2), 10),
    parseInt(hhmm.substr(3, 5), 10)
  ).getTime();
  return withSameDate > date ? withSameDate : withSameDate + 24 * 60 * 60 * 1000;
}

function _profileBasalsInWindow(basals, start, end) {
  if (basals.length === 0) {
    return [];
  }

  var i;
  var out = [];
  function nextProfileBasal() {
    i = (i + 1) % basals.length;
    var lastStart = out[out.length - 1].start;
    return {
      start: _hhmmAfter(basals[i]['time'], lastStart),
      absolute: parseFloat(basals[i]['value']),
    };
  }

  i = 0;
  var startHHMM = new Date(start).toTimeString().substr(0, 5);
  while(i < basals.length - 1 && basals[i + 1]['time'] <= startHHMM) {
    i++;
  }
  out.push({
    start: start,
    absolute: parseFloat(basals[i]['value']),
  });

  var next = nextProfileBasal();
  while(next.start < end) {
    out.push(next);
    next = nextProfileBasal();
  }

  return out;
}

dataProcessor.processTempBasals = function processTempBasals(results) {
  var profileBasals = _basalsFromProfile(results[0]);
  var temps = results[1].map(function(temp) {
    return {
      start: new Date(temp['created_at']).getTime(),
      duration: temp['duration'] === undefined ? 0 : parseInt(temp['duration'], 10) * 60 * 1000,
      absolute: temp['absolute'] === undefined ? 0 : parseFloat(temp['absolute']),
    };
  }).concat([
    {
      start: Date.now() - 24 * 60 * 60 * 1000,
      duration: 0,
    },
    {
      start: Date.now(),
      duration: 0,
    },
  ]).sort(function(a, b) {
    return a.start - b.start;
  });

  var out = [];
  temps.forEach(function(temp) {
    var last = out[out.length - 1];
    if (last && last.duration !== undefined && last.start + last.duration < temp.start) {
      Array.prototype.push.apply(out, _profileBasalsInWindow(profileBasals, last.start + last.duration, temp.start));
    }
    out.push(temp);
  });

  for (let i = 0; i<out.length; i++) {
    const temp = out[i];
    const nextTemp = out[i+1];

    if (temp.duration && (temp.start + temp.duration) > nextTemp.start) {
      temp.duration = nextTemp.start - temp.start;
    }
  }

  return out;
}

export default dataProcessor;
