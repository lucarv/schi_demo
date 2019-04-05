'use strict';

require('dotenv').config();
const debug = require('debug')('listener')

var express = require('express');
var router = express.Router();
var iothub = require('azure-iothub');
var registry = iothub.Registry.fromConnectionString(process.env.CS);
var Client = require('azure-iothub').Client;
var client = Client.fromConnectionString(process.env.CS);

var elevators = [];
var observed = [];

registry.list(function (err, deviceList) {
  if (err) console.log(err);
  else
    deviceList.forEach(function (device) {
      elevators.push(device.deviceId);
    });
});

router.delete('/', function (req, res, next) {
  let listener = req.body.client_id;
  let elevator = req.body.device_id;

  let li = observed.find(el => el.elevator === elevator);
  console.log('Trying to remove: ' + listener + ' from elevator: ' + elevator)
  let idx = li.listeners.indexOf(listener)
  if (idx == -1)
    res.status(500).send('listener ' + listener + ' not listening to ' + elevator);
  else {
    res.status(200).send('removed listener: ' + listener + ' from elevator: ' + elevator);
  }
});

router.post('/', function (req, res, next) {
  let listener = req.body.client_id;
  let elevator = req.body.device_id;

  if (!elevators.includes(elevator))
    // elevator not provisioned in iot hub
    res.status(500).send('unknown device id');
  else {
    let li = observed.find(el => el.elevator === elevator);
    if (!li) { // new observed elevator, start telemetry
      console.log('ADDED NEW ELEVATOR >>>')
      console.log(elevator)
      let observer = {
        elevator: elevator,
        listeners: [listener]
      }
      observed.push(observer);
      console.log('ADDED NEW OBSERVER >>>')
      console.log(observer)
      var methodName = 'start';
      var methodParams = {
        methodName: methodName,
        payload: null,
        timeoutInSeconds: 30,
      };

      client.invokeDeviceMethod(elevator, methodParams, function (err, result) {
        if (err) {
          res.status(500).send('listener: ' + listener + ' already listening to elevator: ' + elevator);
        } else {
          res.status(200).send('added listener: ' + listener + ' to elevator: ' + elevator);
        }
      });
    } else { // add new listener to elevator
      console.log('ELEVATOR ALREADY OBSERVED >>>')
      console.log(elevator)

      if (li.listeners.includes(listener)) {
        console.log('LISTENER ALREADY IN TIST >>>')
        console.log(listener)
        res.status(500).send('listener: ' + listener + ' already listening to elevator: ' + elevator);

      } else {
        console.log('ADDED NEW LISTENER >>>')
        console.log(listener)
        console.log('TO ELEVATOR >>>')
        console.log(elevator)
        li.listeners.push(listener);
        observed.splice(observed.indexOf(li), 1)
        let observer = {
          elevator: elevator,
          listeners: li.listeners
        }
        observed.push(observer)
        console.log('ADDED NEW OBSERVER >>>')
        console.log(observer)
        res.status(200).send('added listener: ' + listener + ' to elevator: ' + elevator);
      }
    }

    /*
		for (let i = 0; i < listeners.length; i++) {
			if (listeners[i].listener == client_id) {
				found = true;
				console.log(listeners[i].listener);
				if (!listeners[i].devices.includes(elevator)) {
					listeners[i].devices.push(elevator);
					res.status(200).send({
						listener: listener,
						'# of observed devices': listeners[i].devices.length,
					});
				} else res.status(500).send('device in observed list');
			}
		}

		if (!found) {
			let devices = [];
			devices.push(elevator);
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