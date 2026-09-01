var ResponsePayload = function(code, payload) {
  this.code = code;
  this.payload = payload;
}

exports.respondWithCode = function(code, payload) {
  return new ResponsePayload(code, payload);
}

var writeJson = exports.writeJson = function(response, arg1, arg2, arg3) {
  var code;
  var payload;
  var headers = {};

  if(arg1 && arg1 instanceof ResponsePayload) {
    writeJson(response, arg1.payload, arg1.code, arg1.headers);
    return;
  }

  if(arg2 && Number.isInteger(arg2)) {
    code = arg2;
    payload = arg1;
  }
  else {
    if(arg1 && Number.isInteger(arg1)) {
      code = arg1;
    }
    else {
      payload = arg1;
    }
  }

  // Handle headers as third argument or as second argument if code is not provided
  if(arg3 && typeof arg3 === 'object') {
    headers = arg3;
  }
  else if(arg1 && typeof arg1 === 'object' && !Number.isInteger(arg1)) {
    // If arg1 is an object with headers property
    if(arg1.headers) {
      headers = arg1.headers;
      payload = arg1.payload || arg1;
    }
  }

  if(!code) {
    // if no response code given, we default to 200
    code = 200;
  }
  
  // Add Content-Type header
  headers['Content-Type'] = 'application/json';
  
  if(typeof payload === 'object' && payload !== null) {
    payload = JSON.stringify(payload, null, 2);
  }
  
  response.writeHead(code, headers);
  response.end(payload);
}
