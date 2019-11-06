import * as should from 'should';
import Alarms from "../app/alarms";

describe('alarms', function() {

  const mockUI = {};
  mockUI.init = function(alarms) {
    mockUI.alarms = alarms;
  };
  mockUI.showAlert = function(message) {
    console.log('TEST:', message);
  };

  const settings = {
    units: 'mgdl'
    , highThreshold: 100
    , lowThreshold: 10
    , predSteps: 2
    , enableAlarms: true
    , staleAlarm: 1
  };

  const now = Date.now();
  const SECOND_AGO = now - 1000;
  const MINUTE_AGO = now - 60 * 1000;

  it('should initialize', function() {
    const a = new Alarms({}, mockUI);
    mockUI.alarms.should.equal(a);
  });

  it('should not trigger alarm if alarms are disabled', function() {
    const a = new Alarms({ enableAlarms: false }, mockUI);
    const alarms = a.checkAndAlarm({ sgv: 1, date: SECOND_AGO }, { sgv: 1 }, settings, now);
    should.not.exist(alarms);
  });

  it('should generate low alarm', function() {
    const a = new Alarms(settings, mockUI);
    const alarms = a.checkAlarms({ sgv: 1, date: SECOND_AGO }, { sgv: 1 }, now);
    alarms[0].message.should.equal('LOW BG: 1');
  });

  it('should generate high alarm', function() {
    const a = new Alarms(settings, mockUI);
    const alarms = a.checkAlarms({ sgv: 101, date: SECOND_AGO }, { sgv: 1 }, now);
    alarms[0].message.should.equal('HIGH BG: 101');
  });

  it('should generate predicted low alarm', function() {
    const a = new Alarms(settings, mockUI);
    const alarms = a.checkAlarms({ sgv: 11, date: SECOND_AGO }, { sgv: 12 }, now);
    alarms[0].message.should.equal('LOW predicted: 9');
  });

  it('should generate predicted high alarm', function() {
    const a = new Alarms(settings, mockUI);
    const alarms = a.checkAlarms({ sgv: 99, date: SECOND_AGO }, { sgv: 90 }, now);
    alarms[0].message.should.equal('HIGH predicted: 117');
  });

  it('should generate stale data alarm', function() {
    const a = new Alarms(settings, mockUI, now);
    const alarms = a.checkAlarms({ sgv: 99, date: Date.now() - (1000*60*2) }, { sgv: 90 }, now);
    alarms[0].message.should.equal('Last CGM reading 2 mins ago');
  });

  it('should not generate stale data alarm if data is is old but not stale', function() {
    settings.staleAlarm = 100;
    const a = new Alarms(settings, mockUI, now);
    const alarms = a.checkAlarms({ sgv: 99, date: Date.now() - (1000*60*90) }, { sgv: 90 }, now);
    alarms[0].message.should.equal('HIGH predicted: 117');
  });

  it('should support snoozing', function() {
    const a = new Alarms(settings, mockUI);

    let showWasCalled = false;
    let hideWasCalled = false;

    mockUI.showAlert = function(message, vibrationtype) {
      showWasCalled = true;
      message.should.equal('HIGH predicted: 117');
    };

    mockUI.hideAlerts = function hide() {
      hideWasCalled = true;
    }

    a.checkAndAlarm({ sgv: 99, date: Date.now() }, { sgv: 90 }, settings, now);    
    showWasCalled.should.equal(true);
    a.snooze(5000);
    showWasCalled = false;
    a.checkAndAlarm({ sgv: 99, date: Date.now() }, { sgv: 90 }, settings, now);    
    showWasCalled.should.equal(false);
    hideWasCalled.should.equal(true);

  });

});
