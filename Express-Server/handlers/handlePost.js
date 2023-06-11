const { PATH, PROOF_MODE, THRESHOLD } = require("../utils/constants");
const { writeInkMLFiles, createInkMLObjects } = require("../utils/fileUtils");
const {
  calculateAverageY,
  calculateLineNumber,
} = require("../utils/traceUtils");
const path = require("path");
const fs = require("fs").promises;

module.exports = async function handlePost(req, res) {
  const data = req.body.toString();
  const fileName = "temp.inkml";
  const filePath = path.join(path.resolve(`${PATH}/temp`), fileName);

  if (PROOF_MODE) {
    const tracesAllInfo = await calculateAverageY(data);
    calculateLineNumber(tracesAllInfo);
    const inkMLObjects = createInkMLObjects(tracesAllInfo);
    const lastWrittenNumbers = writeInkMLFiles(inkMLObjects);
    res.status(200).send(lastWrittenNumbers);
  } else {
    try {
      await fs.writeFile(filePath, data);
      res.status(200).send("File written successfully");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error writing file");
    }
  }
};
