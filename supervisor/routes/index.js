var express = require('express');
var router = express.Router();

var listeners = []

/* GET home page. */
router.get('/', function(req, res, next) {
  res.status(200).send('you got it');
});
router.post('/', function(req, res, next) {
  let client_id = req.body.client_id;
  let devices = []
  devices.push(req.body.device_id)

  let el = {"client_id": client_id, "devices": devices}
  listeners.push(el)
  res.status(200).send('you posted: ' + el)
});


module.exports = router;
