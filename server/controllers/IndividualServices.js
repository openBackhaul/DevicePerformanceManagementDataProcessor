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

      logger.info(
        `POST /initiate-pm-data-update SUCCESS ${execTime}ms`
      );

      logger.info(response, '=== CONTROLLER: Success response ===');
      logger.info('=== END CONTROLLER ===');
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

      if (error.code === 533) {
        statusCode = 533;
      } else if (error.code === 532) {
        statusCode = 532;
      }

      logger.error(
        `POST /initiate-pm-data-update ${statusCode} ERROR ${execTime}ms`
      );

      logger.error(error, '=== CONTROLLER: Error response ===');

      if (statusCode === 533) {
        return utils.writeJson(res, error, 533, headers);
      }

      if (statusCode === 532) {
        return utils.writeJson(res, error, 532, headers);
      }

      return utils.writeJson(res, error, 500, headers);
    });
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
