import * as should from 'should';
import Alarms from "../app/alarms";

describe('alarms', function() {

  const mockUI = {};
  mockUI.init = function(alarms) {
    mockUI.alarms = alarms;
  };
  mockUI.showAlert = function(message) {
    console.log(message);
  };

  const settings = {
    units: 'mgdl'
    , highThreshold: 100
    , lowThreshold: 10
    , predSteps: 2
    , enableAlarms: true
  };

  it('should initialize', function() {
    const a = new Alarms({}, mockUI);
    mockUI.alarms.should.equal(a);
  });

  it('should not trigger alarm if alarms are disabled', function() {
    const a = new Alarms({ enableAlarms: false }, mockUI);
    const alarms = a.checkAndAlarm({ sgv: 1 }, { sgv: 1 }, settings);
    should.not.exist(alarms);
  });

  it('should generate low alarm', function() {
    const a = new Alarms(settings, mockUI);
    const alarms = a.checkAlarms({ sgv: 1 }, { sgv: 1 });
    alarms[0].message.should.equal('LOW BG: 1');
  });

  it('should generate high alarm', function() {
    const a = new Alarms(settings, mockUI);
    const alarms = a.checkAlarms({ sgv: 101 }, { sgv: 1 });
    alarms[0].message.should.equal('HIGH BG: 101');
  });

  it('should generate predicted low alarm', function() {
    const a = new Alarms(settings, mockUI);
    const alarms = a.checkAlarms({ sgv: 11 }, { sgv: 12 });
    alarms[0].message.should.equal('LOW predicted: 9');
  });

  it('should generate predicted high alarm', function() {
    const a = new Alarms(settings, mockUI);
    const alarms = a.checkAlarms({ sgv: 99 }, { sgv: 90 });
    alarms[0].message.should.equal('HIGH predicted: 117');
  });

  it('should support snoozing', function() {
    const a = new Alarms(settings, mockUI);

    let hideWasCalled = false;

    mockUI.showAlert = function(message, vibrationtype) {
      message.should.equal('HIGH predicted: 117');
    };

    mockUI.showAlert = function() {
      hideWasCalled = true;
    };

    a.checkAndAlarm({ sgv: 99 }, { sgv: 90 }, settings);
    a.snooze(5000);

    hideWasCalled.should.equal(true);
  });

});
