'use strict';


var FunctionProfile = require('../service/FunctionProfileService');
var responseBuilder = require('onf-core-model-ap/applicationPattern/rest/server/ResponseBuilder');
var responseCodeEnum = require('onf-core-model-ap/applicationPattern/rest/server/ResponseCode');
var oamLogService = require('onf-core-model-ap/applicationPattern/services/OamLogService');

module.exports.getFunctionProfileDescription = async function getFunctionProfileDescription (req, res, next, uuid) {
  let responseCode = responseCodeEnum.code.OK;
 await FunctionProfile.getFunctionProfileDescription(req.url)
     .then(function (response) {
         responseBuilder.buildResponse(res, responseCode, response);
       })
       .catch(function (response) {
         let sentResp = responseBuilder.buildResponse(res, undefined, response);
         responseCode = sentResp.code;
       });
     oamLogService.recordOamRequest(req.url, req.body, responseCode, req.headers.authorization, req.method);
   };
   

module.exports.getFunctionProfileFunctionName = async function getFunctionProfileFunctionName (req, res, next, uuid) {
  let responseCode = responseCodeEnum.code.OK;
 await FunctionProfile.getFunctionProfileFunctionName(req.url)
     .then(function (response) {
         responseBuilder.buildResponse(res, responseCode, response);
       })
       .catch(function (response) {
         let sentResp = responseBuilder.buildResponse(res, undefined, response);
         responseCode = sentResp.code;
       });
     oamLogService.recordOamRequest(req.url, req.body, responseCode, req.headers.authorization, req.method);
   };
   

module.exports.getFunctionProfileIsActive = async function getFunctionProfileIsActive (req, res, next, uuid) {
  let responseCode = responseCodeEnum.code.OK;
 await FunctionProfile.getFunctionProfileIsActive(req.url)
     .then(function (response) {
         responseBuilder.buildResponse(res, responseCode, response);
       })
       .catch(function (response) {
         let sentResp = responseBuilder.buildResponse(res, undefined, response);
         responseCode = sentResp.code;
       });
     oamLogService.recordOamRequest(req.url, req.body, responseCode, req.headers.authorization, req.method);
   };
   

module.exports.getFunctionProfileParameterList = async function getFunctionProfileParameterList (req, res, next, uuid) {
  let responseCode = responseCodeEnum.code.OK;
  await FunctionProfile.getFunctionProfileParameterList(req.url)
     .then(function (response) {
         responseBuilder.buildResponse(res, responseCode, response);
       })
       .catch(function (response) {
         let sentResp = responseBuilder.buildResponse(res, undefined, response);
         responseCode = sentResp.code;
       });
     oamLogService.recordOamRequest(req.url, req.body, responseCode, req.headers.authorization, req.method);
   };
   

module.exports.getFunctionProfileSubFunctionList = async function getFunctionProfileSubFunctionList (req, res, next, uuid) {
  let responseCode = responseCodeEnum.code.OK;
 await FunctionProfile.getFunctionProfileSubFunctionList(req.url)
      .then(function (response) {
          responseBuilder.buildResponse(res, responseCode, response);
        })
        .catch(function (response) {
          let sentResp = responseBuilder.buildResponse(res, undefined, response);
          responseCode = sentResp.code;
        });
      oamLogService.recordOamRequest(req.url, req.body, responseCode, req.headers.authorization, req.method);
    };
    

module.exports.putFunctionProfileIsActive = async function putFunctionProfileIsActive (req, res, next, body, uuid) {
  let responseCode = responseCodeEnum.code.NO_CONTENT;
 await FunctionProfile.putFunctionProfileIsActive(req.url, body)
       .then(function (response) {
            responseBuilder.buildResponse(res, responseCode, response);
          })
          .catch(function (response) {
            let sentResp = responseBuilder.buildResponse(res, undefined, response);
            responseCode = sentResp.code;
          });
        oamLogService.recordOamRequest(req.url, req.body, responseCode, req.headers.authorization, req.method);
      };