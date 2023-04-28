const express = require("express");
const PORT = 4000;
const cors = require("cors");
const app = express();

const seshatRouter = require("./routes/seshat");

// Middleware to log calls
function logger(req, res, next) {
  console.log(`${req.method} ${req.url}`);
  next();
} 

app.use(express.urlencoded({extended: true}));
app.use(express.text());
app.use(cors());
app.use(logger);
app.use('/seshat', seshatRouter);

app.listen(PORT, () => console.log(`Server now listening on port ${PORT}`));
