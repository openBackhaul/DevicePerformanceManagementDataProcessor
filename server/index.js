'use strict';

var path = require('path');
var http = require('http');
var appCommons = require('onf-core-model-ap/applicationPattern/commons/AppCommons');

var oas3Tools = require('oas3-tools');
const logger = require('./service/LoggingService.js').getLogger();
//const P1StreamPmData = require('./specificFunctions/p1StreamPmData/P1StreamPmData-temp.js');
const P1StreamPmData = require('./specificFunctions/p1StreamPmData/P1StreamPmData.js');
var serverPort = 4031;
appCommons.openApiValidatorOptions.validateSecurity = false;
if (process.env.DEBUG && process.env.DEBUG.toLowerCase() === "true") {
    logger.warn("Working in debug mode");
    logger.warn("Checking validation")
    // appCommons.openApiValidatorOptions.validateSecurity = false;
    // appCommons.openApiValidatorOptions.validateResponses = false;
    // appCommons.openApiValidatorOptions.validateRequests = false;
    logger.warn("Validate Security: " + appCommons.openApiValidatorOptions.validateSecurity);
    logger.warn("Validate Responses: " + appCommons.openApiValidatorOptions.validateResponses);
    logger.warn("Validate Requests: " + appCommons.openApiValidatorOptions.validateRequests);
}
//const prepareElasticsearch = require('./service/individualServices/ElasticsearchPreparation');
// swaggerRouter configuration
var options = {
    routing: {
        controllers: path.join(__dirname, './controllers')
    },
};

// uncomment if you do not want to validate security e.g. operation-key, basic auth, etc
// appCommons.openApiValidatorOptions.validateSecurity = false;
var expressAppConfig = oas3Tools.expressAppConfig(path.join(__dirname, 'api/openapi.yaml'), options);
var app = expressAppConfig.getApp();
appCommons.setupExpressApp(app);
/*
// Initialize the Swagger middleware
http.createServer(app).listen(serverPort, function () {
    console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
    console.log('Swagger-ui is available on http://localhost:%d/docs', serverPort);
});*/

//setting the path to the database 
global.databasePath = './database/config.json';
global.runtimeConfigPath = './database/runtime.json';
//appCommons.performApplicationRegistration();


  http.createServer(app).listen(serverPort, function () {
        console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
        console.log('Swagger-ui is available on http://localhost:%d/docs', serverPort);
    });
    appCommons.performApplicationRegistration();

//  start streaming AFTER success
   async function initial(){
    await P1StreamPmData.run().catch(err => {
        console.error(`Error running P1StreamPmData: ${err}`);
    });
   }
   initial();
/* prepareElasticsearch(false).catch(err => {
    console.error(`Error preparing Elasticsearch : ${err}`);
}).finally(() => {
    // Initialize the Swagger middleware
    http.createServer(app).listen(serverPort, function () {
        console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
        console.log('Swagger-ui is available on http://localhost:%d/docs', serverPort);
    });
    appCommons.performApplicationRegistration();
}
); */