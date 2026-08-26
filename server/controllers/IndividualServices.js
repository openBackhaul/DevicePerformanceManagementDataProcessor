'use strict';

var utils = require('../utils/writer.js');
var IndividualServices = require('../service/IndividualServicesService');

module.exports.bequeathYourDataAndDie = function bequeathYourDataAndDie(req, res, next, body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  IndividualServices.bequeathYourDataAndDie(body, user, originator, xCorrelator, traceIndicator, customerJourney)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
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
