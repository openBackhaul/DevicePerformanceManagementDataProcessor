const ERRORS = require('./ErrorsEnum');

const p1FormattingOutputApt = (input) => {
  try {
    const resultCC = input["result-cc"];

    if (resultCC == undefined) {
      return ERRORS.RESULTCC_NOT_PROVIDED;
    }

    let ccObj = resultCC["core-model-1-4:control-construct"][0];
    let ltpObjs = ccObj['logical-termination-point'];

    let airIfListObj = [];
    let ethContListObj = [];
    for (const [key, value] of Object.entries(ltpObjs)) {
      if (value['layer-protocol'][0]['layer-protocol-name'].endsWith('AIR_LAYER')) {
        let airIfPac = value['layer-protocol'][0]['air-interface-2-0:air-interface-pac'];
        let ltpAugPac = value['ltp-augment-1-0:ltp-augment-pac'];

        let airIfObj = {
          'air-interface-identifiers': {
            'mount-name': ccObj['equipment-augment-1-0:control-construct-pac']['external-label'],
            'link-endpoint-id': ltpAugPac['external-label'],
            'link-id': ltpAugPac['link-id'],
            'logical-termination-point-id': value['uuid'],
            'link-aggregation-identifiers': [], // must be an array
          },
          'air-interface-configuration': airIfPac['air-interface-configuration'],
          'air-interface-performance-measurements-list': airIfPac['air-interface-historical-performances']['historical-performance-data-list'],
          'transmission-mode-list': airIfPac['air-interface-capability']['transmission-mode-list'],
          'idu-cpu-temperature': {},
          'retrieval-timestamp': resultCC['batch-timestamp']  // <-- should be processed in advance
        }
        airIfListObj.push(airIfObj);
      } else if (value['layer-protocol'][0]['layer-protocol-name'].includes('ETHERNET_CONTAINER')) {
        let ltpAugPac = value['ltp-augment-1-0:ltp-augment-pac'];
        let ethHistPerf = value['layer-protocol'][0]['ethernet-container-2-0:ethernet-container-pac']['ethernet-container-historical-performances']['number-of-historical-performance-sets'] == 0 ? [] :
          value['layer-protocol'][0]['ethernet-container-2-0:ethernet-container-pac']['ethernet-container-historical-performances']['number-of-historical-performance-sets']['historical-performance-data-list'];

        let ethContObj = {
          'ethernet-container-identifiers': {
            'mount-name': ccObj['equipment-augment-1-0:control-construct-pac']['external-label'],
            'interface-name': ltpAugPac['original-ltp-name'],  // {$input#/result-cc/logical-termination-point/ltp-augment-1-0:ltp-augment-pac/original-ltp-name}
            'logical-termination-point-id': value['uuid'],   // $input#/result-cc/logical-termination-point/uuid}
          },
          'ethernet-container-performance-measurements-list': ethHistPerf // $input#/result-cc/logical-termination-point/layer-protocol/ethernet-container-2-0:ethernet-container-pac/ethernet-container-historical-performances/historical-performance-data-list}'
        }

        ethContListObj.push(ethContObj);
      }
    }

    // Return value
    return {
      "air-interface-list": airIfListObj,
      "ethernet-container-list": ethContListObj
    };

  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
}

module.exports = p1FormattingOutputApt;
