const ERRORS = require('./ErrorsEnum');

const p1FormattingOutputApt = (input) => {
  try {
    const resultCC = input["result-cc"];

    let ccKeys = Object.keys(resultCC["core-model-1-4:control-construct"][0]);
    let ltpObjs = resultCC["core-model-1-4:control-construct"][0]['logical-termination-point'];


    for (const [key, value] of Object.entries(ltpObjs)) {
      if (value['layer-protocol'][0]['layer-protocol-name'].endsWith('AIR_LAYER')) {
        console.log("This is Radio entry: " + value['layer-protocol'][0]['layer-protocol-name']);
      }

      if (value['layer-protocol'][0]['layer-protocol-name'].includes('ETHERNET_CONTAINER')) {
        console.log("This is Eth container entry: " + value['layer-protocol'][0]['layer-protocol-name']);
      }
    }
    // Return value
    return {
      "air-interface-list": undefined,
      "ethernet-container-list": undefined
    };

  } catch (err) {
    return ERRORS.GENERAL_ERROR;
  }
}

module.exports = p1FormattingOutputApt;
