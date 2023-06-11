require("dotenv").config();
const express = require("express");
const PORT = process.env.PORT || 4000;
const cors = require("cors");
const app = express();
const helmet = require("helmet");

const seshatRouter = require("./routes/seshat");

// Middleware to log calls
function logger(req, res, next) {
  console.log(`${req.method} ${req.url}`);
  next();
}

app.use(express.urlencoded({ extended: true }));
app.use(express.text());
app.use(cors());
app.use(helmet());
app.use(logger);
app.use("/seshat", seshatRouter);

// Error middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});

app.listen(PORT, () => console.log(`Server now listening on port ${PORT}`));
