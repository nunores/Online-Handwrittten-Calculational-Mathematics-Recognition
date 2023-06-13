const SeshatRecogniser = require("../adapters/seshatRecogniser");

const recognisers = {
  'seshat': SeshatRecogniser
}

module.exports = async function handleGet(req, res) {
  try {

    if (!(req.query.recogniser in recognisers)) {
      throw new Error(`Unknown recogniser: ${req.query.recogniser}`);
    }
    const recogniser = new recognisers[req.query.recogniser]();

    const lastWrittenNumbers = Array.from(req.query.lastWrittenNumbers, Number);
    const results = await recogniser.recognise(lastWrittenNumbers);

    res.send(results);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};
