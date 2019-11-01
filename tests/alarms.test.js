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
      units: 'mgdl',
      highThreshold: 100,
      lowThreshold: 10,
      predSteps: 2,
      enableAlarms: true
  };

  it('should initialize', function() {
    const a = new Alarms({}, mockUI);
    mockUI.alarms.should.equal(a);
  });

  it('should not trigger alarm if alarms are disabled', function() {
    const a = new Alarms({enableAlarms: false}, mockUI);
    const alarms = a.checkAlarms({ sgv: 1 }, { sgv: 1 });
    should.not.exist(alarms);
  });

  it('should raise low alarm', function() {
    const a = new Alarms(settings, mockUI);
    const alarms = a.checkAlarms({ sgv: 1 }, { sgv: 1 });
    alarms[0].message.should.equal('LOW BG: 1');
  });

  it('should raise high alarm', function() {
    const a = new Alarms(settings, mockUI);
    const alarms = a.checkAlarms({ sgv: 101 }, { sgv: 1 });
    alarms[0].message.should.equal('HIGH BG: 101');
  });


});
