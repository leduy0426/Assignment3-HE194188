const express = require('express');
const router = express.Router();
const { seedDatabase } = require('../controllers/seedController');

router.post('/', seedDatabase);

module.exports = router;

