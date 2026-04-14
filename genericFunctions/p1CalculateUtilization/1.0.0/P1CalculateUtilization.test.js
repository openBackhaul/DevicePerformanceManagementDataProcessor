
const p1CalculateUtilization = require('./P1CalculateUtilization');
const ERRORS = require('./ErrorsEnum.js');
const fs = require('fs');

describe('p1CalculateUtilization', () => {

  test('should return "General Error" if input is null', () => {
    expect(p1CalculateUtilization(null))
      .toBe(ERRORS.GENERAL_ERROR);
  });

  test('read from real dataset', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf.json', 'utf8');
    let perfData = JSON.parse(dataFile);
    let inputStruct = {
      'historical-performance-data': perfData,
      'aggregation-group': {
        'physical-server-ltp-list': [
          'XXXXX',
          'YYYYY',
          'ZZZZZ'
        ]
      },
      'result-cc': {
        'logical-termination-point': undefined
      }
    };

    let result = p1CalculateUtilization(inputStruct);
  });

  test('read from real dataset 2', () => {
    let dataFile = fs.readFileSync(__dirname + '/datasets/ethHistoricalPerf2.json', 'utf8');
    let perfData = JSON.parse(dataFile);
    let inputStruct = {
      'historical-performance-data': perfData,
      'aggregation-group': {
        'physical-server-ltp-list': [
          'XXXXX',
          'YYYYY',
          'ZZZZZ'
        ]
      },
      'result-cc': {
        'logical-termination-point': undefined
      }
    };

    let result = p1CalculateUtilization(inputStruct);
  });

        // let dataFile = fs.readFileSync(__dirname + '/transmissionModeList1.json', 'utf8');
        // let transmissionMode = JSON.parse(dataFile);
});