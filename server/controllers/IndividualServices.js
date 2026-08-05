'use strict';

var responseCodeEnum = require('onf-core-model-ap/applicationPattern/rest/server/ResponseCode');
var restResponseHeader = require('onf-core-model-ap/applicationPattern/rest/server/ResponseHeader');
var restResponseBuilder = require('onf-core-model-ap/applicationPattern/rest/server/ResponseBuilder');
var IndividualServices = require('../service/IndividualServicesService');
var executionAndTraceService = require('onf-core-model-ap/applicationPattern/services/ExecutionAndTraceService');
var { appState } = require('../core/appState');

var utils = require('../utils/writer.js');
var IndividualServices = require('../service/IndividualServicesService');

module.exports.bequeathYourDataAndDie = function bequeathYourDataAndDie (req, res, next, body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  IndividualServices.bequeathYourDataAndDie(body, user, originator, xCorrelator, traceIndicator, customerJourney)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.initiatePmDataUpdate = function initiatePmDataUpdate (req, res, next, body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  IndividualServices.initiatePmDataUpdate(body, user, originator, xCorrelator, traceIndicator, customerJourney, appState)
    .then(function (response) {
      console.log('=== CONTROLLER: Success response ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('=== END CONTROLLER ===');
      
      utils.writeJson(res, response);
    })
    .catch(function (error) {
      console.log('=== CONTROLLER: Error response ===');
      console.log(JSON.stringify(error, null, 2));
      console.log('=== END CONTROLLER ===');
      
      // Handle error 533: Mount name discrepancy
      if (error.code === 533) {
        utils.writeJson(res, error, 533);
      } 
      // Handle error 532: Unconnected mounts
      else if (error.code === 532) {
        utils.writeJson(res, error, 532);
      } 
      else {
        utils.writeJson(res, error);
      }
    });
};
