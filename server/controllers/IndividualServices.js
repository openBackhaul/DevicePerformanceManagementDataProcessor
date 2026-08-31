'use strict';

var IndividualServices = require('../service/IndividualServicesService');

var utils = require('../utils/writer.js');
var IndividualServices = require('../service/IndividualServicesService');
const logger = require('../service/LoggingService').getLogger();

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
  
  IndividualServices.initiatePmDataUpdate(body, user, originator, xCorrelator, traceIndicator, customerJourney)
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
      
      // Add outdated mount names to response if present
      if (response['outdated-mount-names'] && response['outdated-mount-names'].length > 0) {
        responseBody = response;
      }
      
      // Always log request summary
      logger.info(`POST /initiate-pm-data-update ${statusCode} SUCCESS ${execTime}ms`);
      
      // Detailed trace only if enabled
      logger.info(response, '=== CONTROLLER: Success response ===');
      logger.info('=== END CONTROLLER ===');

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
      logger.error(`POST /initiate-pm-data-update ${statusCode} ERROR ${execTime}ms`);
      
      // Detailed trace only if enabled
      logger.error(error, '=== CONTROLLER: Error response ===');

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
}

module.exports.documentPmDataProcessing = function documentPmDataProcessing(req, res, next, body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  IndividualServices.documentPmDataProcessing(body, user, originator, xCorrelator, traceIndicator, customerJourney)
    .then(function (response) {
      if (typeof response === 'string') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(response);
      } else {
        utils.writeJson(res, response);
      }
    })
    .catch(function (response) {
      if (typeof response === 'string') {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(response);
      } else {
        utils.writeJson(res, response);
      }
    });
};
