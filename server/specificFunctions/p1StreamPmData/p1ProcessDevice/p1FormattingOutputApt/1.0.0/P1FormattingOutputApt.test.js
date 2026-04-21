const p1FormattingOutputApt = require('./P1FormattingOutputApt');
const ERRORS = require('./ErrorsEnum');
const fs = require('fs');
const path = require('path');

describe('p1FormattingOutputApt', () => {

  let cc;

  beforeAll(() => {
    const dataFile = fs.readFileSync(
      path.join(__dirname, 'datasets', 'cc_clean_CO01715.json'),
      'utf8'
    );
    cc = JSON.parse(dataFile);
  });

  test('should return apt-output-format wrapper', () => {
    const result = p1FormattingOutputApt({ 'result-cc': cc });

    expect(result).toBeDefined();
    expect(result['format-name']).toBe('apt-output-format');
    expect(result['output-format']).toBeDefined();
  });

  test('should create air-interface-list', () => {
    const result = p1FormattingOutputApt({ 'result-cc': cc });

    const airList =
      result['output-format']['air-interface-list'];

    expect(Array.isArray(airList)).toBe(true);
    expect(airList.length).toBeGreaterThan(0);
  });

  test('air interface identifiers should exist', () => {
    const air =
      p1FormattingOutputApt({ 'result-cc': cc })
      ['output-format']['air-interface-list'][0];

    const identifiers = air['air-interface-identifiers'];

    expect(identifiers).toBeDefined();
    expect(typeof identifiers['mount-name']).toBe('string');
    expect(typeof identifiers['logical-termination-point-id']).toBe('string');
  });

  test('link-id should be max 9 characters', () => {
    const air =
      p1FormattingOutputApt({ 'result-cc': cc })
      ['output-format']['air-interface-list'][0];

    const linkId = air['air-interface-identifiers']['link-id'];

    if (linkId) {
      expect(linkId.length).toBeLessThanOrEqual(9);
    }
  });

  test('air-interface-performance-measurements-list exists', () => {
    const air =
      p1FormattingOutputApt({ 'result-cc': cc })
      ['output-format']['air-interface-list'][0];

    const perfList = air['air-interface-performance-measurements-list'];

    expect(Array.isArray(perfList)).toBe(true);
    expect(perfList.length).toBeGreaterThan(0);
  });

  test('operated transmission modes must have time > 0', () => {
    const airList =
      p1FormattingOutputApt({ 'result-cc': cc })
      ['output-format']['air-interface-list'];

    airList.forEach(air => {
      air['air-interface-performance-measurements-list'].forEach(p => {
        const operated = p['operated-transmission-modes-list'] || [];
        operated.forEach(mode => {
          expect(mode.time).toBeGreaterThan(0);
        });
      });
    });
  });


  test('should create ethernet-container-list', () => {
    const result = p1FormattingOutputApt({ 'result-cc': cc });

    const ethList =
      result['output-format']['ethernet-container-list'];

    expect(Array.isArray(ethList)).toBe(true);
    expect(ethList.length).toBeGreaterThan(0);
  });

  test('ethernet performance list must always be array', () => {
    const ethList =
      p1FormattingOutputApt({ 'result-cc': cc })
      ['output-format']['ethernet-container-list'];

    ethList.forEach(ec => {
      expect(
        Array.isArray(ec['ethernet-container-performance-measurements-list'])
      ).toBe(true);
    });
  });

  test('should return RESULTCC_NOT_PROVIDED', () => {
    const result = p1FormattingOutputApt({});
    expect(result).toBe(ERRORS.RESULTCC_NOT_PROVIDED);
  });

  test('should return RESULTCC_INVALID for malformed input', () => {
    const result = p1FormattingOutputApt({ 'result-cc': {} });
    expect(result).toBe(ERRORS.RESULTCC_INVALID);
  });

  // not valid anymore
  // test('returns error: resultCc incomplete when LTP list missing', () => {
  //   const incompleteCc = {
  //     'core-model-1-4:control-construct': [
  //       {// logical-termination-point missing
  //       }]
  //   };

  //   const result = p1FormattingOutputApt({ 'result-cc': incompleteCc });

  //   expect(result).toBe(ERRORS.RESULTCC_INCOMPLETE);
  // });

});
