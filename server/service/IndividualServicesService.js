'use strict';

var p1LoadParameters = require('../genericFunctions/p1LoadParameters/P1LoadParameters');
var p1DocumentFunction = require('../genericFunctions/p1DocumentFunction/P1DocumentFunction');// TODO
var { getParamFromFunction } = require('../utils/functionTree');


/**
 * Initiates process of embedding a new release
 *
 * body V1_bequeathyourdataanddie_body 
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-configuration/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * no response value expected for this operation
 **/
exports.bequeathYourDataAndDie = function (body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  return new Promise(function (resolve, reject) {
    resolve();
  });
}

exports.documentPmDataProcessing = async function (body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  return new Promise(async function (resolve, reject) {
    try {
      var ownFunctionResult = await p1LoadParameters.run({
        functionName: 'documentPmDataProcessing'
      });

      var functionNameToDocument = getParamFromFunction(
        ownFunctionResult.parameters,
        'documentPmDataProcessing',
        'nameOfToBeDocumentedFunction'
      );

      if (!functionNameToDocument) {
        return reject({
          code: 500,
          message: 'Missing nameOfToBeDocumentedFunction in documentPmDataProcessing configuration'
        });
      }

      var documentedFunctionResult = await p1LoadParameters.run({
        functionName: functionNameToDocument,
        configFile: ownFunctionResult.configFile
      });

      var documentation = await p1DocumentFunction({
        "parameters-of-to-be-documented-function": documentedFunctionResult.parameters
      });

      resolve(documentation);
    } catch (error) {
      reject({
        code: 500,
        message: error.message || 'Failed to create PM data processing documentation'
      });
    }
  });
}