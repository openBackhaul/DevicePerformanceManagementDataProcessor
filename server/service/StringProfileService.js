// @ts-check
'use strict';

const fileOperation = require('onf-core-model-ap/applicationPattern/databaseDriver/JSONDriver');



/**
 * Returns the enumeration values of the String
 *
 * uuid String 
 * returns inline_response_200_18
 **/
exports.getStringProfileEnumeration = async function (url) {
  let value = await fileOperation.readFromDatabaseAsync(url);
  if (!value) {
    value = [];
  }
  return {
    "string-profile-1-0:enumeration": value
  };
}


/**
 * Returns the pattern of the String
 *
 * uuid String 
 * returns inline_response_200_19
 **/
exports.getStringProfilePattern = async function (url) {
  let value = await fileOperation.readFromDatabaseAsync(url);
  if (!value) {
    value = "";
  }
  return {
    "string-profile-1-0:pattern": value
  };
}


/**
 * Returns the name of the String
 *
 * returns inline_response_200_17
 **/
exports.getStringProfileStringName = async function (url) {
  const value = await fileOperation.readFromDatabaseAsync(url);
  return {
    "string-profile-1-0:string-name": value
  };
}


/**
 * Returns the configured value of the String
 *
 * * returns inline_response_200_20
 **/
exports.getStringProfileStringValue = async function (url) {
  const value = await fileOperation.readFromDatabaseAsync(url);
  return {
    "string-profile-1-0:string-value": value
  };
}


/**
 * Configures value of the String
 *
 * body Stringprofileconfiguration_stringvalue_body 
 * no response value expected for this operation
 **/
exports.putStringProfileStringValue = function(url, body) {
 return new Promise(async function (resolve, reject) {
     try {
       await fileOperation.writeToDatabaseAsync(url, body, false);
       resolve();
     } catch (error) {
       reject(error);
     }
   });
}