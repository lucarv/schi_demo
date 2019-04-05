'use strict';

require('dotenv').config();
const debug = require('debug')('listener')

var express = require('express');
var router = express.Router();
var iothub = require('azure-iothub');
var registry = iothub.Registry.fromConnectionString(process.env.CS);
var Client = require('azure-iothub').Client;
var client = Client.fromConnectionString(process.env.CS);

var devices = [];
var observed = [];
var listeners = [];
var keepalive = [];

registry.list(function (err, deviceList) {
  if (err) debug(err);
  else
    deviceList.forEach(function (device) {
      devices.push(device.deviceId);
    });
});

const stop = (device) => {
  let li = observed.find(el => el.device === device);
  observed.splice(observed.indexOf(li), 1) // remove device from list

  // stop telemetry by invoking direct method
  var methodName = 'stop';
  var methodParams = {
    methodName: methodName,
    payload: null,
    timeoutInSeconds: 30,
  };

  client.invokeDeviceMethod(device, methodParams, function (err, result) {
    if (err) {
      debug('could not stop telemetry on <' + device + '>');
    } else {
      debug('removed listener from device <' + device + '>');
    }
  });
}

const timerMgmt = (listener) => {
  listeners.push(listener);
  let timer = setTimeout(function () {
    let timeout = keepalive.find(el => el.handler === timer['_idleStart']);
    debug('timeout for timer <' + timeout.timer['_idleStart'] + '>');
    listeners.splice(listeners.indexOf(timeout.li, 1))

    // remove listener from devices
    for (let i = 0; i < observed.length; i++) {
      let idx = observed[i].listeners.indexOf(timeout.li)
      if (idx > -1) {
        observed[i].listeners.splice(idx, 1);
        if (observed[i].listeners.length == 0) {
          stop(observed[i].device)
        }
      }
    }
  }, process.env.KEEPALIVE);
  debug('starting timer <' + timer['_idleStart'] + '>')
  keepalive.push({
    handler: timer['_idleStart'],
    li: listener,
    timer: timer
  })
}

router.post('/keepalive', function (req, res, next) {
  let listener = req.body.client_id;
  debug('keepalive from <' + listener + '>')
  let li = keepalive.find(el => el.li === listener);
  debug('clear timeout <' + li.timer['_idleStart'] + '>')
  keepalive.splice(keepalive.indexOf(li))
  clearTimeout(li.timer)
  timerMgmt(listener)
  res.send('ack');
});

router.delete('/', function (req, res, next) {
  let listener = req.body.client_id;
  let device = req.body.device_id;

  if (observed.length == 0)
    res.status(500).send('no observers registered');
  else {
    let li = observed.find(el => el.device === device);
    if (li) {
      debug('Trying to remove <' + listener + '> from device <' + device + '>')
      let idx = li.listeners.indexOf(listener)
      if (idx == -1)
        res.status(404).send('listener <' + listener + '> not listening to <' + device + '>');
      else {
        li.listeners.splice(idx, 1) // remove listener from device list
        observed.splice(observed.indexOf(li), 1) // remove device from list
        debug('listeners remaining: ' + li.listeners.length)
        if (li.listeners.length > 0) {
          let observer = {
            device: device,
            listeners: li.listeners
          }
          observed.push(observer);
          res.status(200).send('removed listener <' + listener + '> from device <' + device + '>');
        } else {
          stop(device);
          res.status(200).send('no more listeners <' + listener + '> from device <' + device + '>');
        }
      }
    } else
      res.status(404).send('listener <' + listener + '> not listening to <' + device+ '>');
  }
});

router.post('/', function (req, res, next) {
  let listener = req.body.client_id;
  let device = req.body.device_id;

  if (!listeners.includes(listener)) {
    debug('create timer for <' + listener+ '>');
    timerMgmt(listener);
  } 

  if (!devices.includes(device))
    // device not provisioned in iot hub
    res.status(404).send('unknown device id');
  else {
    let li = observed.find(el => el.device === device);
    if (!li) { // new observed device, start telemetry
      debug('added new device <' + device + '>')

      let observer = {
        device: device,
        listeners: [listener],
      }
      observed.push(observer);
      debug('added new observer <' + observer + '>')

      // start telemetry by invoking direct method
      var methodName = 'start';
      var methodParams = {
        methodName: methodName,
        payload: null,
        timeoutInSeconds: 30,
      };
      client.invokeDeviceMethod(device, methodParams, function (err, result) {
        if (err) {
          res.status(500).send('could not start telemetry on <' + device + '>');
        } else {
          res.status(200).send('added listener <' + listener + '> to device <' + device + '>');
        }
      });
    } else { // add new listener to device
      debug('device <' + device + '> already observed');
      debug(device);

      if (li.listeners.includes(listener)) {
        debug('listener <' + listener + '> already listed');
        debug(listener)
        res.status(500).send('listener <' + listener + 'Z already listening to device <' + device + '>');

      } else {
        debug('added listener <' + listener + '> to device <' + device + '>');
        li.listeners.push(listener);
        observed.splice(observed.indexOf(li), 1)
        let observer = {
          device: device,
          listeners: li.listeners
        }
        observed.push(observer)
        debug('added new observer <' + observer + '>')
        res.status(200).send('added listener: ' + listener + ' to device: ' + device);
      }
    }
  }
});


module.exports = router;