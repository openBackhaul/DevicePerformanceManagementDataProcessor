'use strict';

var IndividualServices = require('../service/IndividualServicesService');

var utils = require('../utils/writer.js');
var IndividualServices = require('../service/IndividualServicesService');
var responseCodeEnum = require('onf-core-model-ap/applicationPattern/rest/server/ResponseCode');
var RestResponseHeader = require('onf-core-model-ap/applicationPattern/rest/server/ResponseHeader');
var RestResponseBuilder = require('onf-core-model-ap/applicationPattern/rest/server/ResponseBuilder');
var ExecutionAndTraceService = require('onf-core-model-ap/applicationPattern/services/ExecutionAndTraceService');
const logger = require('../service/LoggingService').getLogger();

module.exports.bequeathYourDataAndDie = function bequeathYourDataAndDie(req, res, next, body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  IndividualServices.bequeathYourDataAndDie(body, user, originator, xCorrelator, traceIndicator, customerJourney)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};
module.exports.initiatePmDataUpdate = function initiatePmDataUpdate(
  req,
  res,
  next,
  body,
  user,
  originator,
  xCorrelator,
  traceIndicator,
  customerJourney
) {
  var startTime = Date.now();

  IndividualServices.initiatePmDataUpdate(
    body,
    user,
    originator,
    xCorrelator,
    traceIndicator,
    customerJourney
  )
    .then(function (response) {

      var execTime = Date.now() - startTime;

      var headers = {
        'x-correlator': xCorrelator,
        'exec-time': execTime,
        'backend-time': execTime,
        'life-cycle-state': 'OPERATIONAL'
      };

      logger.debug(
        `POST /initiate-pm-data-update SUCCESS ${execTime}ms`
      );

      logger.debug(response, '=== CONTROLLER: Success response ===');
      logger.debug('=== END CONTROLLER ===');
      /*
       * Response handling according to the OpenAPI specification:
       * 200 -> already-up-to-date-mount-names returned
       * 204 -> update initiated with no response body
      */
      if (
        response &&
        Array.isArray(response['already-up-to-date-mount-names'])
      ) {

        return utils.writeJson(
          res,
          {
            'already-up-to-date-mount-names':
              response['already-up-to-date-mount-names']
          },
          200,
          headers
        );
      }

      return utils.writeJson(
        res,
        null,
        204,
        headers
      );
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

      if (error && [400, 532, 533].includes(error.code)) {
        statusCode = error.code;
      }

      logger.error(
        `POST /initiate-pm-data-update ${statusCode} ERROR ${execTime}ms`
      );

      logger.error(error, '=== CONTROLLER: Error response ===');

      return utils.writeJson(res, error, statusCode, headers);
    });
};

module.exports.provideDeviceDataStoreDump = async function provideDeviceDataStoreDump(req, res, next, body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  let startTime = process.hrtime();
  let responseCode = responseCodeEnum.code.OK;
  let responseBodyToDocument = {};
  await IndividualServices.provideDeviceDataStoreDump(body, user, originator, xCorrelator, traceIndicator, customerJourney)
    .then(async function (responseBody) {
      responseBodyToDocument = responseBody;
      let responseHeader = await RestResponseHeader.createResponseHeader(xCorrelator, startTime, req.url);
      RestResponseBuilder.buildResponse(res, responseCode, responseBody, responseHeader);
    })
    .catch(async function (responseBody) {
      let responseHeader = await RestResponseHeader.createResponseHeader(xCorrelator, startTime, req.url, -1);
      let sentResp = RestResponseBuilder.buildResponse(res, undefined, responseBody, responseHeader);
      responseCode = sentResp.code;
      responseBodyToDocument = sentResp.body;
    });
  let execTime = await RestResponseHeader.executionTimeInMilliseconds(startTime);
  if (!execTime) execTime = 0;
  else execTime = Math.round(execTime);
  ExecutionAndTraceService.recordServiceRequest(xCorrelator, traceIndicator, user, originator, req.url, responseCode, req.body, responseBodyToDocument, execTime);
};

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
