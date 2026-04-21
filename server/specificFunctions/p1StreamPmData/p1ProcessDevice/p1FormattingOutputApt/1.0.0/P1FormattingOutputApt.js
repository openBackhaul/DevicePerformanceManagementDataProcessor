const ERRORS = require('./ErrorsEnum');

const EQUIP = 'equipment';
const LTP = 'logical-termination-point';
const EQP_AUG = 'equipment-augment-1-0:control-construct-pac';

const p1FormattingOutputApt = (input) => {
  try {
    if (!input || !input['result-cc']) {
      return ERRORS.RESULTCC_NOT_PROVIDED;
    }

    const resultCC = input['result-cc'];

    if (resultCC[EQUIP] == null ||
      resultCC[LTP] == null ||
      resultCC[EQP_AUG] == null ||
      resultCC['batch-timestamp'] == null) {
      return ERRORS.RESULTCC_INVALID;
    }

    const ltpObjs = resultCC[LTP];

    if (!ltpObjs) {
      return ERRORS.RESULTCC_INCOMPLETE;
    }

    const mountName = resultCC[EQP_AUG]?.['external-label'];
    const retrievalTimestamp = resultCC['batch-timestamp'];
    const iduOrCpuTemperature = resolveTemperature(resultCC[EQUIP]);

    const airInterfaceList = [];
    const ethernetContainerList = [];

    for (const ltp of Object.values(ltpObjs)) {
      const layerProtocol = ltp['layer-protocol']?.[0];
      if (!layerProtocol) {
        continue;
      }

      const lpName = layerProtocol['layer-protocol-name'];

      if (lpName.endsWith('AIR_LAYER')) {
        airInterfaceList.push(
          buildAirInterface(
            ltp,
            layerProtocol,
            ltpObjs,
            mountName,
            retrievalTimestamp,
            iduOrCpuTemperature
          )
        );
      }

      if (lpName.includes('ETHERNET_CONTAINER')) {
        ethernetContainerList.push(
          buildEthernetContainer(ltp, layerProtocol, mountName)
        );
      }
    }

    const result = {
      'format-name': 'apt-output-format',
      'output-format': {
        'air-interface-list': airInterfaceList,
        'ethernet-container-list': ethernetContainerList
      }
    };

    return result;
  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
};

module.exports = p1FormattingOutputApt;

// Helper  Methods

function buildAirInterface(
  ltp,
  layerProtocol,
  allLtps,
  mountName,
  retrievalTimestamp,
  temperature
) {
  const airPac = layerProtocol['air-interface-2-0:air-interface-pac'];
  const ltpAug = ltp['ltp-augment-1-0:ltp-augment-pac'];

  return {
    'air-interface-identifiers': {
      'mount-name': mountName,
      'link-endpoint-id': ltpAug?.['external-label'],
      'link-id': ltpAug?.['link-id']?.substring(0, 9) ,
      'logical-termination-point-id': ltp.uuid,
      'link-aggregation-identifiers':
        resolveLinkAggregation(ltp, allLtps)
    },

    'air-interface-configuration': mapAirInterfaceConfiguration(
      airPac['air-interface-configuration'],
      airPac['air-interface-capability']
    ),

    'air-interface-performance-measurements-list':
      mapAirPerformance(airPac),

    'transmission-mode-list':
      airPac['air-interface-capability']?.['transmission-mode-list'] || [],

    'idu-cpu-temperature': temperature,

    'retrieval-timestamp': retrievalTimestamp
  };
}

function mapAirInterfaceConfiguration(config, capability) {
  return {
    'configured-atpc-is-on': config?.['atpc-is-on'],
    'configured-atpc-threshold-upper': config?.['atpc-thresh-upper'],
    'configured-atpc-threshold-lower': config?.['atpc-thresh-lower'],
    'configured-tx-power': config?.['tx-power'],

    'configured-modulation-minimum':
      resolveTransmissionMode(config?.['transmission-mode-min'], capability),

    'configured-modulation-maximum':
      resolveTransmissionMode(config?.['transmission-mode-max'], capability)
  };
}

function resolveTransmissionMode(modeName, capability) {
  if (!modeName || !capability) {
    return null;
  }

  const modes = capability['transmission-mode-list'] || [];
  const match = modes.find(
    m => m['transmission-mode-name'] === modeName
  );

  if (!match) {
    return null;
  }

  return {
    'number-of-states': match['number-of-states'],
    'name-at-lct': match['modulation-scheme-name-at-lct'],
    'configured-capacity-minimum': match['capacity'],
    'configured-capacity-maximum': match['capacity']
  };
}

function mapAirPerformance(airPac) {
  const hist =
    airPac?.['air-interface-historical-performances']
    ?.['historical-performance-data-list'] || [];

  return hist.map(entry => {
    const perf = entry['performance-data'];

    return {
      ...entry,
      'operated-transmission-modes-list':
        (perf?.['time-xstates-list'] || [])
          .filter(x => x.time > 0)
          .map(x => ({
            'transmission-mode-name': x['transmission-mode'],
            'time': x.time
          }))
    };
  });
}

function resolveLinkAggregation(ltp, allLtps) {
  const result = [];
  const parallel = ltp?.['parallel-ltp'] || [];

  for (const uuid of parallel) {

    const target = Object.values(allLtps)
      .find(x => x.uuid === uuid);

    if (!target) {
      continue;
    }

    const targetLp = target?.['layer-protocol']?.[0];
    const lpName = targetLp?.['layer-protocol-name'];

    const aug = target?.['ltp-augment-1-0:ltp-augment-pac'];

    // AIR interface aggregation
    if (lpName?.endsWith('LAYER_PROTOCOL_NAME_TYPE_AIR_LAYER')) {
      result.push({
        uuid,
        'link-id': aug?.['link-id']?.substring(0, 9)
      });
    }

    // WIRE interface aggregation
    if (lpName?.endsWith('LAYER_PROTOCOL_NAME_TYPE_WIRE_LAYER')) {
      result.push({
        uuid,
        'interface-name': aug?.['original-ltp-name']
      });
    }
  }

  return result;
}

function resolveTemperature(equipmentStruct) {
  let cpuTemp;
  let iduTemp;

  for (const eq of equipmentStruct) {
    const category = eq?.['structure']?.['category'];

    const temp = eq?.['actual-equipment']?.['physical-properties']?.['temperature'];

    if (category?.endsWith('EQUIPMENT_CATEGORY_CENTRAL_PROCESSING_UNIT') &&
      temp !== undefined) {
      cpuTemp = temp;
    }

    if (category?.endsWith('EQUIPMENT_CATEGORY_SUBRACK') &&
      temp !== undefined) {
      iduTemp = temp;
    }
  }

  let retValue = cpuTemp !== undefined ? cpuTemp : iduTemp;
  return retValue == undefined ? '' : retValue;
}

function buildEthernetContainer(ltp, layerProtocol, mountName) {
  const ltpAug = ltp['ltp-augment-1-0:ltp-augment-pac'];

  const perfList =
    layerProtocol?.['ethernet-container-2-0:ethernet-container-pac']
    ?.['ethernet-container-historical-performances']
    ?.['historical-performance-data-list'];

  const result = {
    'ethernet-container-identifiers': {
      'mount-name': mountName,
      'interface-name': ltpAug?.['original-ltp-name'],
      'logical-termination-point-id': ltp.uuid
    },

    'ethernet-container-performance-measurements-list':
      Array.isArray(perfList)
        ? perfList.map(entry => ({ ...entry }))
        : []
  };

  return result;
}


