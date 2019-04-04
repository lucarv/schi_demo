'use strict';

require('dotenv').config()
var express = require('express');
var router = express.Router();
var iothub = require('azure-iothub');
var registry = iothub.Registry.fromConnectionString(process.env.CS);
var elevators = [];
var observed = [];

registry.list(function (err, deviceList) {
  if (err)
    console.log(err)
  else
    deviceList.forEach(function (device) {
      elevators.push(device.deviceId)
    })
});


var listeners = []

/* GET home page. */
router.get('/', function (req, res, next) {
  res.status(200).send('you got it');
});
router.post('/', function (req, res, next) {
  let client_id = req.body.client_id;

  let found = false,
    devices = [];

  if (!elevators.includes(req.body.device_id))
    res.status(500).send('unknown device id')
  else {
    // if new observed elevator, start telemetry
    if (!observed.includes(req.body.device_id)) {
      observed.push(req.body.device_id);
    }
    console.log(observed)

    for (let i = 0; i < listeners.length; i++) {
      if (listeners[i].client_id == client_id) {
        found = true;
        console.log(listeners[i].client_id)
        if (!listeners[i].devices.includes(req.body.device_id)) {
          listeners[i].devices.push(req.body.device_id)
          res.status(200).send({
            "listener": client_id,
            "# of observed devices": listeners[i].devices.length
          })
        } else
          res.status(500).send('device in observed list')
      }
    }

    if (!found) {
      let devices = []
      devices.push(req.body.device_id)
      let el = {
        "client_id": client_id,
        "devices": devices
      }
      listeners.push(el)
      res.status(200).send({
        "# of listeners": listeners.length
      })
    }
  }
});


module.exports = router;