const { log } = require("console");
const { exec } = require("child_process");
const express = require("express");
const router = express.Router();

const handleGet = require('../handlers/handleGet');
const handlePost = require('../handlers/handlePost');

router.get("/", handleGet);
router.post("/", handlePost);


module.exports = router;
