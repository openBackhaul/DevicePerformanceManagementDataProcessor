const { validateConnectionStatus } = require('../../service/individualServices/initiatePmDataUpdate/util');

describe('validateConnectionStatus', () => {
  test('should return null when all devices are connected', () => {
    const metadataArray = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected'
      },
      {
        'mount-name': 'CO18303',
        'connection-status': 'connected'
      }
    ];
    const inputMountNames = ['CO18302', 'CO18303'];
    
    expect(validateConnectionStatus(metadataArray, inputMountNames)).toBeNull();
  });

  test('should return unconnected devices when some are disconnected', () => {
    const metadataArray = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected'
      },
      {
        'mount-name': 'CO18303',
        'connection-status': 'disconnected'
      },
      {
        'mount-name': 'CO18304',
        'connection-status': 'connected'
      }
    ];
    const inputMountNames = ['CO18302', 'CO18303', 'CO18304'];
    
    const result = validateConnectionStatus(metadataArray, inputMountNames);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('unconnectedMountNames');
    expect(result.unconnectedMountNames).toContain('CO18303');
  });

  test('should return all devices when all are disconnected', () => {
    const metadataArray = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'disconnected'
      },
      {
        'mount-name': 'CO18303',
        'connection-status': 'disconnected'
      }
    ];
    const inputMountNames = ['CO18302', 'CO18303'];
    
    const result = validateConnectionStatus(metadataArray, inputMountNames);
    expect(result).not.toBeNull();
    expect(result.unconnectedMountNames).toHaveLength(2);
    expect(result.unconnectedMountNames).toContain('CO18302');
    expect(result.unconnectedMountNames).toContain('CO18303');
  });

  test('should handle empty metadata array', () => {
    const metadataArray = [];
    const inputMountNames = ['CO18302'];
    
    expect(validateConnectionStatus(metadataArray, inputMountNames)).toBeNull();
  });

  test('should handle various connection statuses', () => {
    const metadataArray = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected'
      },
      {
        'mount-name': 'CO18303',
        'connection-status': 'unknown'
      },
      {
        'mount-name': 'CO18304',
        'connection-status': 'error'
      }
    ];
    const inputMountNames = ['CO18302', 'CO18303', 'CO18304'];
    
    const result = validateConnectionStatus(metadataArray, inputMountNames);
    expect(result).not.toBeNull();
    expect(result.unconnectedMountNames).toHaveLength(2);
    expect(result.unconnectedMountNames).toContain('CO18303');
    expect(result.unconnectedMountNames).toContain('CO18304');
  });

  test('should only check devices in input mount names', () => {
    const metadataArray = [
      {
        'mount-name': 'CO18302',
        'connection-status': 'connected'
      },
      {
        'mount-name': 'CO18303',
        'connection-status': 'disconnected'
      },
      {
        'mount-name': 'CO18304',
        'connection-status': 'disconnected'
      }
    ];
    const inputMountNames = ['CO18302', 'CO18303']; // Only checking first two
    
    const result = validateConnectionStatus(metadataArray, inputMountNames);
    expect(result).not.toBeNull();
    expect(result.unconnectedMountNames).toHaveLength(1);
    expect(result.unconnectedMountNames).toContain('CO18303');
  });
});