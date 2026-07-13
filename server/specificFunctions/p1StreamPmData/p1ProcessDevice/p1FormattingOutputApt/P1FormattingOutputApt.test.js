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

  describe('Functional Data Extraction & Transformation', () => {
    test('should resolve temperature with priority given to CPU over IDU', () => {
      const input = {
        'result-cc': {
          'equipment': [
            {
              'actual-equipment': {
                'structure': { 'category': 'EQUIPMENT_CATEGORY_CENTRAL_PROCESSING_UNIT' },
                'physical-properties': { 'temperature': 45 }
              }
            },
            {
              'actual-equipment': {
                'structure': { 'category': 'EQUIPMENT_CATEGORY_SUBRACK' },
                'physical-properties': { 'temperature': 35 }
              }
            }
          ],
          'logical-termination-point': {
            'ltp1': {
              'uuid': 'ltp1',
              'layer-protocol': [{
                'layer-protocol-name': 'AIR_LAYER',
                'air-interface-2-0:air-interface-pac': {
                  'air-interface-configuration': {},
                  'air-interface-capability': {},
                  'air-interface-historical-performances': { 'historical-performance-data-list': [] }
                }
              }],
              'ltp-augment-1-0:ltp-augment-pac': {}
            }
          },
          'equipment-augment-1-0:control-construct-pac': { 'external-label': 'mount' },
          'batch-timestamp': '2023-10-25T10:00:00Z'
        }
      };
      const res = p1FormattingOutputApt(input);
      expect(res['output-format']['air-interface-list'][0]['idu-cpu-temperature']).toBe(45);
    });



    test('resolveTransmissionMode: should return null if mode not found', () => {
      const input = {
        'result-cc': {
          'equipment': [],
          'logical-termination-point': {
            'ltp1': {
              'uuid': 'ltp1',
              'layer-protocol': [{
                'layer-protocol-name': 'AIR_LAYER',
                'air-interface-2-0:air-interface-pac': {
                  'air-interface-configuration': { 'transmission-mode-min': 'UNKNOWN' },
                  'air-interface-capability': { 'transmission-mode-list': [{ 'transmission-mode-name': 'KNOWN' }] }
                }
              }]
            }
          },
          'equipment-augment-1-0:control-construct-pac': { 'external-label': 'mount' },
          'batch-timestamp': '2023-10-25T10:00:00Z'
        }
      };
      const res = p1FormattingOutputApt(input);
      const config = res['output-format']['air-interface-list'][0]['air-interface-configuration'];
      expect(config['configured-modulation-minimum']).toBeNull();
    });

    test('should truncate link-id to strictly first 9 characters', () => {
      const input = {
        'result-cc': {
          'equipment': [],
          'logical-termination-point': {
            'ltp1': {
              'uuid': 'ltp1',
              'layer-protocol': [{
                'layer-protocol-name': 'AIR_LAYER',
                'air-interface-2-0:air-interface-pac': { 'air-interface-configuration': {}, 'air-interface-capability': {} }
              }],
              'ltp-augment-1-0:ltp-augment-pac': { 'link-id': '1234567890ABC' }
            }
          },
          'equipment-augment-1-0:control-construct-pac': { 'external-label': 'mount' },
          'batch-timestamp': '2023-10-25T10:00:00Z'
        }
      };
      const res = p1FormattingOutputApt(input);
      expect(res['output-format']['air-interface-list'][0]['air-interface-identifiers']['link-id']).toBe('123456789');
    });

    test('Ethernet container performance should default to empty array if not array', () => {
      const input = {
        'result-cc': {
          'equipment': [],
          'logical-termination-point': {
            'eth1': {
              'uuid': 'eth1',
              'layer-protocol': [{
                'layer-protocol-name': 'ETHERNET_CONTAINER',
                'ethernet-container-2-0:ethernet-container-pac': {
                  'ethernet-container-historical-performances': { 'historical-performance-data-list': 'not-an-array' }
                }
              }]
            }
          },
          'equipment-augment-1-0:control-construct-pac': { 'external-label': 'mount' },
          'batch-timestamp': '2023-10-25T10:00:00Z'
        }
      };
      const res = p1FormattingOutputApt(input);
      expect(res['output-format']['ethernet-container-list'][0]['ethernet-container-performance-measurements-list']).toEqual([]);
    });

    test('should correctly handle 0 degrees when resolving temperature', () => {
      const input = {
        'result-cc': {
          'equipment': [
            {
              'actual-equipment': {
                'structure': { 'category': 'EQUIPMENT_CATEGORY_CENTRAL_PROCESSING_UNIT' },
                'physical-properties': { 'temperature': 0 }
              }
            }
          ],
          'logical-termination-point': {
            'ltp1': {
              'uuid': 'ltp1',
              'layer-protocol': [{
                'layer-protocol-name': 'AIR_LAYER',
                'air-interface-2-0:air-interface-pac': {
                  'air-interface-configuration': {},
                  'air-interface-capability': {},
                  'air-interface-historical-performances': { 'historical-performance-data-list': [] }
                }
              }]
            }
          },
          'equipment-augment-1-0:control-construct-pac': { 'external-label': 'mount' },
          'batch-timestamp': '2023-10-25T10:00:00Z'
        }
      };
      const res = p1FormattingOutputApt(input);
      expect(res['output-format']['air-interface-list'][0]['idu-cpu-temperature']).toBe(0);
    });

    test('should return empty lists when no matching LTPs exist', () => {
      const input = {
        'result-cc': {
          'equipment': [],
          'logical-termination-point': {
            'other': { 'layer-protocol': [{ 'layer-protocol-name': 'OTHER_LAYER' }] }
          },
          'equipment-augment-1-0:control-construct-pac': { 'external-label': 'mount' },
          'batch-timestamp': '2023-10-25T10:00:00Z'
        }
      };
      const res = p1FormattingOutputApt(input);
      expect(res['output-format']['air-interface-list']).toEqual([]);
      expect(res['output-format']['ethernet-container-list']).toEqual([]);
    });

    test('resolveTransmissionMode: should return correct object structure on match', () => {
      const input = {
        'result-cc': {
          'equipment': [],
          'logical-termination-point': {
            'ltp1': {
              'uuid': 'ltp1',
              'layer-protocol': [{
                'layer-protocol-name': 'AIR_LAYER',
                'air-interface-2-0:air-interface-pac': {
                  'air-interface-configuration': { 'transmission-mode-min': 'MODE_A' },
                  'air-interface-capability': {
                    'transmission-mode-list': [{
                      'transmission-mode-name': 'MODE_A',
                      'number-of-states': 4,
                      'modulation-scheme-name-at-lct': 'QPSK',
                      'capacity': 1000
                    }]
                  }
                }
              }]
            }
          },
          'equipment-augment-1-0:control-construct-pac': { 'external-label': 'mount' },
          'batch-timestamp': '2023-10-25T10:00:00Z'
        }
      };
      const res = p1FormattingOutputApt(input);
      const mode = res['output-format']['air-interface-list'][0]['air-interface-configuration']['configured-modulation-minimum'];
      expect(mode).toEqual({
        'number-of-states': 4,
        'name-at-lct': 'QPSK',
        'configured-capacity-minimum': 1000,
        'configured-capacity-maximum': 1000
      });
    });

  });
});
