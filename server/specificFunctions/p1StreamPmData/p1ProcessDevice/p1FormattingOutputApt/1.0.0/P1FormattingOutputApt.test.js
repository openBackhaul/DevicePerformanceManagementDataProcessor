const p1FormattingOutputApt = require('./P1FormattingOutputApt');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');

describe('p1FormattingOutputApt', () => {

    test('Testing using the same capcity value = 200', () => {
      let dataFile = fs.readFileSync(__dirname + '/datasets/cc_CO01715.json', 'utf8');
      let cc = JSON.parse(dataFile);
      // console.log(dataFile);
      const result = p1FormattingOutputApt({
        "result-cc": cc,
      });

      // expect(result["interval-capacity"]).toBe(200);
    });

});
