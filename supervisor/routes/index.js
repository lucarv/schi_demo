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

registry.list(function (err, deviceList) {
  if (err) debug(err);
  else
    deviceList.forEach(function (device) {
      devices.push(device.deviceId);
    });
});

router.delete('/', function (req, res, next) {
  let listener = req.body.client_id;
  let device = req.body.device_id;

  if (observed.length == 0)
    res.status(500).send('no observers registered');
  else {
    let li = observed.find(el => el.device === device);
    if (li) {
      debug('Trying to remove: ' + listener + ' from device: ' + device)
      let idx = li.listeners.indexOf(listener)
      if (idx == -1)
        res.status(404).send('listener ' + listener + ' not listening to ' + device);
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
          res.status(200).send('removed listener: ' + listener + ' from device: ' + device);
        } else {
          // stop telemetry by invoking direct method
          var methodName = 'stop';
          var methodParams = {
            methodName: methodName,
            payload: null,
            timeoutInSeconds: 30,
          };
          client.invokeDeviceMethod(device, methodParams, function (err, result) {
            if (err) {
              res.status(500).send('could not stop telemetry on: ' + device);
            } else {
              res.status(200).send('added listener: ' + listener + ' to device: ' + device);
            }
          });
        }
      }
    } else
      res.status(404).send('listener ' + listener + ' not listening to ' + device);
  }
});

router.post('/', function (req, res, next) {
  let listener = req.body.client_id;
  let device = req.body.device_id;

  if (!devices.includes(device))
    // device not provisioned in iot hub
    res.status(404).send('unknown device id');
  else {
    let li = observed.find(el => el.device === device);
    if (!li) { // new observed device, start telemetry
      debug('ADDED NEW device >>>')
      debug(device)
      let observer = {
        device: device,
        listeners: [listener]
      }
      observed.push(observer);
      debug('ADDED NEW OBSERVER >>>')
      debug(observer)

      // start telemetry by invoking direct method
      var methodName = 'start';
      var methodParams = {
        methodName: methodName,
        payload: null,
        timeoutInSeconds: 30,
      };
      client.invokeDeviceMethod(device, methodParams, function (err, result) {
        if (err) {
          res.status(500).send('could not start telemetry on: ' + device);
        } else {
          res.status(200).send('added listener: ' + listener + ' to device: ' + device);
        }
      });
    } else { // add new listener to device
      debug('device ALREADY OBSERVED >>>');
      debug(device);

      if (li.listeners.includes(listener)) {
        debug('LISTENER ALREADY IN TIST >>>')
        debug(listener)
        res.status(500).send('listener: ' + listener + ' already listening to device: ' + device);

      } else {
        debug('ADDED NEW LISTENER >>>')
        debug(listener)
        debug('TO device >>>')
        debug(device)
        li.listeners.push(listener);
        observed.splice(observed.indexOf(li), 1)
        let observer = {
          device: device,
          listeners: li.listeners
        }
        observed.push(observer)
        debug('ADDED NEW OBSERVER >>>')
        debug(observer)
        res.status(200).send('added listener: ' + listener + ' to device: ' + device);
      }
    }

    /*
		for (let i = 0; i < listeners.length; i++) {
			if (listeners[i].listener == client_id) {
				found = true;
				debug(listeners[i].listener);
				if (!listeners[i].devices.includes(device)) {
					listeners[i].devices.push(device);
					res.status(200).send({
						listener: listener,
						'# of observed devices': listeners[i].devices.length,
					});
				} else res.status(500).send('device in observed list');
			}
		}

		if (!found) {
			let devices = [];
			devices.push(device);
			let el = {
				listener: listener,
				devices: devices,
			};
			listeners.push(el);
			res.status(200).send({
				'# of listeners': listeners.length,
			});
    }
    */
  }
});

module.exports = router;