// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';
require('dotenv').config()

var uuid = require('uuid');
var Protocol = require('azure-iot-device-mqtt').Mqtt;
var Client = require('azure-iot-device').Client;
var Message = require('azure-iot-device').Message;
var connectionString = process.env.CS;
// fromConnectionString must specify a transport constructor, coming from any transport package.
var client = Client.fromConnectionString(connectionString, Protocol);
var observed = false

const startTele = (request, response) => {
  observed = true;
  response.send(200, 'telemetry started', function (err) {
    if (!!err) {
      console.error('An error ocurred when sending a method response:\n' +
        err.toString());
    } else {
      console.log('Response to method \'' + request.methodName +
        '\' sent successfully.');
    }
  });
}

const stopTele = (request, response) => {
  observed = false;
  response.send(200, 'telemetry stopped', function (err) {
    if (!!err) {
      console.error('An error ocurred when sending a method response:\n' +
        err.toString());
    } else {
      console.log('Response to method \'' + request.methodName +
        '\' sent successfully.');
    }
  });
}

const telemetry = () => {

  // any type of data can be sent into a message: bytes, JSON...but the SDK will not take care of the serialization of objects.
  //let payload = message_array[Math.floor(Math.random() * (200 - 1) + 1)]
  let payload = {
    "datapoint_1": Math.floor(Math.random() * (200 - 1) + 1),
    "datapoint_2": Math.floor(Math.random() * (100 - 50) + 50),
  }
  let message = new Message(JSON.stringify(payload));
  if (observed) {
    client.sendEvent(message, function (err) {
      if (err) {
        console.error('Could not send: ' + err.toString());
        process.exit(-1);
      } else {
        console.log(message.getData() + ' sent');
      }
    });
  } else
    console.log('not observed - do nothing')
};

client.open(function (err) {
  if (err) {
    console.error('could not open IotHub client');
  } else {
    console.log('client opened');

    setInterval(telemetry, 3000);

    client.onDeviceMethod('start', startTele);
    client.onDeviceMethod('stop', stopTele);
  }
});