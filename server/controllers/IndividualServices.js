'use strict';

var responseCodeEnum = require('onf-core-model-ap/applicationPattern/rest/server/ResponseCode');
var restResponseHeader = require('onf-core-model-ap/applicationPattern/rest/server/ResponseHeader');
var restResponseBuilder = require('onf-core-model-ap/applicationPattern/rest/server/ResponseBuilder');
var IndividualServices = require('../service/IndividualServicesService');
var executionAndTraceService = require('onf-core-model-ap/applicationPattern/services/ExecutionAndTraceService');
var { appState } = require('../core/appState');

var utils = require('../utils/writer.js');
var IndividualServices = require('../service/IndividualServicesService');

// Trace function - enabled via ENABLE_TRACES environment variable
function trace(message) {
  if (process.env.ENABLE_TRACES === 'true') {
    console.log(message);
  }
}

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
  var startTime = Date.now();
  
  IndividualServices.initiatePmDataUpdate(body, user, originator, xCorrelator, traceIndicator, customerJourney, appState)
    .then(function (response) {
      var execTime = Date.now() - startTime;
      
      // Determine status code and prepare response
      var statusCode = 204;
      var responseBody = null;
      var headers = {
        'x-correlator': xCorrelator,
        'exec-time': execTime,
        'backend-time': execTime, // TODO: Calculate actual backend time
        'life-cycle-state': 'OPERATIONAL' // TODO: Read from config
      };
      
      // If throttle is active, response has already-up-to-date-mount-names
      if (response['already-up-to-date-mount-names']) {
        statusCode = 200;
        responseBody = response;
      }
      
      // Always log request summary
      console.log(`POST /initiate-pm-data-update ${statusCode} SUCCESS ${execTime}ms`);
      
      // Detailed trace only if enabled
      trace('=== CONTROLLER: Success response ===');
      trace(JSON.stringify(response, null, 2));
      trace('=== END CONTROLLER ===');
      
      utils.writeJson(res, responseBody, statusCode, headers);
    })
    .catch(function (error) {
      var execTime = Date.now() - startTime;
      
      var headers = {
        'x-correlator': xCorrelator,
        'exec-time': execTime,
        'backend-time': execTime,
        'life-cycle-state': 'OPERATIONAL'
      };
      
      var statusCode = 500;
      if (error.code === 533) {
        statusCode = 533;
      } else if (error.code === 532) {
        statusCode = 532;
      }
      
      // Always log request summary
      console.log(`POST /initiate-pm-data-update ${statusCode} ERROR ${execTime}ms`);
      
      // Detailed trace only if enabled
      trace('=== CONTROLLER: Error response ===');
      trace(JSON.stringify(error, null, 2));
      trace('=== END CONTROLLER ===');
      
      // Handle error 533: Mount name discrepancy
      if (error.code === 533) {
        utils.writeJson(res, error, 533, headers);
      } 
      // Handle error 532: Unconnected mounts
      else if (error.code === 532) {
        utils.writeJson(res, error, 532, headers);
      } 
      else {
        utils.writeJson(res, error, 500, headers);
      }
    });
};
