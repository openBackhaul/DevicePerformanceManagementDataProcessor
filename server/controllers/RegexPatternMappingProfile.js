'use strict';


var RegexPatternMappingProfile = require('../service/RegexPatternMappingProfileService');
var responseBuilder = require('onf-core-model-ap/applicationPattern/rest/server/ResponseBuilder');
var responseCodeEnum = require('onf-core-model-ap/applicationPattern/rest/server/ResponseCode');
var oamLogService = require('onf-core-model-ap/applicationPattern/services/OamLogService');

module.exports.getRegexPatternMappingProfileMappingListValue = async function getRegexPatternMappingProfileMappingListValue (req, res, next, uuid) {
   let responseCode = responseCodeEnum.code.OK;
 await RegexPatternMappingProfile.getRegexPatternMappingProfileMappingListValue(req.url)
    .then(function (response) {
          responseBuilder.buildResponse(res, responseCode, response);
        })
        .catch(function (response) {
          let sentResp = responseBuilder.buildResponse(res, undefined, response);
          responseCode = sentResp.code;
        });
      oamLogService.recordOamRequest(req.url, req.body, responseCode, req.headers.authorization, req.method);
    };

module.exports.getRegexPatternMappingProfileMappingNameValue = async function getRegexPatternMappingProfileMappingNameValue (req, res, next, uuid) {
 let responseCode = responseCodeEnum.code.OK;
 await RegexPatternMappingProfile.getRegexPatternMappingProfileMappingNameValue(req.url)
    .then(function (response) {
          responseBuilder.buildResponse(res, responseCode, response);
        })
        .catch(function (response) {
          let sentResp = responseBuilder.buildResponse(res, undefined, response);
          responseCode = sentResp.code;
        });
      oamLogService.recordOamRequest(req.url, req.body, responseCode, req.headers.authorization, req.method);
    };

module.exports.getRegexPatternMappingProfilePurposeValue = async function getRegexPatternMappingProfilePurposeValue (req, res, next, uuid) {
 let responseCode = responseCodeEnum.code.OK;
 await RegexPatternMappingProfile.getRegexPatternMappingProfilePurposeValue(req.url)
    .then(function (response) {
          responseBuilder.buildResponse(res, responseCode, response);
        })
        .catch(function (response) {
          let sentResp = responseBuilder.buildResponse(res, undefined, response);
          responseCode = sentResp.code;
        });
      oamLogService.recordOamRequest(req.url, req.body, responseCode, req.headers.authorization, req.method);
    };

module.exports.putRegexPatternMappingProfileMappingListValue =async function putRegexPatternMappingProfileMappingListValue (req, res, next, body, uuid) {
 let responseCode = responseCodeEnum.code.NO_CONTENT;
 await RegexPatternMappingProfile.putRegexPatternMappingProfileMappingListValue(req.url, body)
    .then(function (response) {
         responseBuilder.buildResponse(res, responseCode, response);
       })
       .catch(function (response) {
         let sentResp = responseBuilder.buildResponse(res, undefined, response);
         responseCode = sentResp.code;
       });
     oamLogService.recordOamRequest(req.url, req.body, responseCode, req.headers.authorization, req.method);
   };