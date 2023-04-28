const { log } = require("console");
const { exec } = require("child_process");
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const util = require("util");
const parseString = require("xml2js").parseString;
const router = express.Router();

const PATH = "../seshat";

const PROOF_MODE = true;
const THRESHOLD = 200;

router.get("/multiple", handleMultipleLines);
router.post("/", handlePost);

/**
 * Calculates the average Y coordinate for each trace in the given data set.
 * @param {string} data - The data set to process.
 * @returns {Promise<Array>} - An array of objects containing the trace ID, average Y coordinate, and the array of coordinates.
 */
async function calculateAverageY(data) {
  try {
    const result = await parseXml(data);
    const traces = result.ink.trace;
    const yAvgArray = traces.map((trace, index) => {
      const coordinates = extractCoordinates(trace);
      const averageY = calculateAverageYCoordinate(coordinates);
      return { traceId: index, yAverage: averageY, coords: coordinates };
    });
    yAvgArray.sort((a, b) => a.yAverage - b.yAverage);
    return yAvgArray;
  } catch (err) {
    console.error(err);
    return [];
  }
}

/**
 * Parses the given XML string into a JavaScript object.
 * @param {string} xml - The XML string to parse.
 * @returns {Promise<Object>} - The parsed JavaScript object.
 */
async function parseXml(xml) {
  return new Promise((resolve, reject) => {
    parseString(xml, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Extracts the coordinates from the given trace object.
 * @param {Object} trace - The trace object to extract coordinates from.
 * @returns {Array} - An array of coordinate strings in the format "x y".
 */
function extractCoordinates(trace) {
  const coordinates = trace._.split(", ").map((element) => element.trim());
  coordinates.pop();
  return coordinates;
}

/**
 * Calculates the average Y coordinate for the given array of coordinate strings.
 * @param {Array} coordinates - An array of coordinate strings in the format "x y".
 * @returns {number} - The average Y coordinate.
 */
function calculateAverageYCoordinate(coordinates) {
  const sum = coordinates.reduce((acc, coord) => {
    const [x, y] = coord.split(" ");
    return acc + parseFloat(y);
  }, 0);
  return sum / coordinates.length;
}

/**
 * Calculates the line number of each object in an array of objects based on a threshold value.
 *
 * @param {Array} tracesAllInfo - An array of objects containing a `yAverage` property.
 * @returns {void} This function does not return anything; it modifies the original array of objects in place.
 */
function calculateLineNumber(tracesAllInfo) {
  let counter = 0;
  let fixedValue = tracesAllInfo[0].yAverage;

  for (let i = 0; i < tracesAllInfo.length; i++) {
    const yAvgObj = tracesAllInfo[i];

    if (yAvgObj.yAverage - fixedValue > THRESHOLD) {
      fixedValue = yAvgObj.yAverage;
      counter++;
    }

    yAvgObj.lineNumber = counter;
  }
}

/**
 * Sorts an array of objects containing tracing information by lineNumber and traceId, groups the objects by lineNumber,
 * and creates an InkML string for each group of traces, returning an object containing each InkML string separately
 * with its corresponding lineNumber as the key.
 *
 * @param {Array} tracesAllInfo - An array of objects containing tracing information, each with the following properties:
 *   @property {number} lineNumber - The line number of the trace.
 *   @property {number} traceId - The ID of the trace.
 *   @property {Array} coords - An array of coordinate values for the trace, in the form [x1, y1, x2, y2, ..., xn, yn].
 * @returns {Object} An object containing each InkML string separately with its corresponding lineNumber as the key.
 */
function createInkMLObjects(tracesAllInfo) {
  // Sort by lineNumber, then traceId
  tracesAllInfo.sort((a, b) => {
    if (a.lineNumber === b.lineNumber) {
      return a.traceId - b.traceId;
    } else {
      return a.lineNumber - b.lineNumber;
    }
  });

  // Group the objects by lineNumber
  const groups = {};
  for (const { lineNumber, traceId, coords } of tracesAllInfo) {
    if (!groups[lineNumber]) {
      groups[lineNumber] = {
        lineNumber,
        inkML: "",
      };
    }
    const coordsString = coords
      .reduce((acc, curr, i) => {
        if (i % 2 === 0 && i + 1 < coords.length) {
          return [...acc, `${coords[i]}, ${coords[i + 1]}`];
        }
        return acc;
      }, [])
      .join(", ");

    groups[
      lineNumber
    ].inkML += `<trace id="${traceId}">${coordsString}</trace>\n`;
  }

  // Create ink strings for each lineNumber
  const inkMLObjects = Object.values(groups).map(({ lineNumber, inkML }) => ({
    lineNumber,
    inkML: `<ink xmlns="http://www.w3.org/2003/InkML">\n${inkML}</ink>`,
  }));

  return inkMLObjects;
}

/**
 * Writes InkML files to the PATH directory
 *
 * @param {Object[]} inkMLObjects - An array of objects containing InkML strings to write.
 * @returns {number[]} - An array containing the indices of the last written files.
 */
function writeInkMLFiles(inkMLObjects) {
  const lastWrittenNumbers = [];

  inkMLObjects.forEach((obj, i) => {
    const fileName = `temp${i}.inkml`;
    const filePath = path.join(`${PATH}/temp`, fileName);
    fs.writeFile(filePath, obj.inkML, (err) => {
      if (err) {
        console.error(`Error writing file ${fileName}: ${err}`);
      } else {
        console.log(`File ${fileName} written successfully`);
      }
    });
    lastWrittenNumbers.push(i);
  });

  return lastWrittenNumbers;
}

/**
 * Returns an array of Seshat commands based on an array of last written numbers.
 *
 * @param {Array} lastWrittenNumbers - An array of last written numbers.
 * @returns {Array} - An array of Seshat commands.
 */
function buildSeshatCommands(lastWrittenNumbers) {
  return lastWrittenNumbers.map(
    (number) =>
      `cd ${PATH} && ./seshat -c Config/CONFIG -i temp/temp${number}.inkml -o out.inkml -r render.pgm -d out.dot`
  );
}

/**
 * Extracts the LaTeX expression from the Seshat output string.
 *
 * @param {string} input - The Seshat output string.
 * @returns {string|null} The LaTeX expression if found, null otherwise.
 */
function extractLatexExpression(input) {
  const regex = /LaTeX:\s*(.*)/;
  const matches = input.match(regex);
  return matches[1].trim();
}

/********************** GET + POST HANDLERS ******************************/

async function handleMultipleLines(req, res) {
  try {
    const lastWrittenNumbers = Array.from(req.query.lastWrittenNumbers, Number);
    const seshatCommands = buildSeshatCommands(lastWrittenNumbers);

    const promises = seshatCommands.map((command) => {
      return util
        .promisify(exec)(command)
        .then(({ stdout, stderr }) => {
          if (stderr) {
            console.error(`stderr: ${stderr}`);
            throw new Error("Internal Server Error");
          }
          const latexExpression = extractLatexExpression(stdout);
          return latexExpression;
        });
    });

    const results = await Promise.all(promises);

    for (let i = 0; i < results.length; i++) {
      results[i] = results[i].replace(/ COMMA /g, ", ");
      
    }

    //Verify in every pair if "={}", adjust accordingly, if not, don't change anything
    if (results.length > 1) {
      const toVerify = results.filter((_, i) => i % 2 !== 0); // Get odd-indexed elements
      console.log("TO VERIFY COMPLETE: ", toVerify);

      const regex = /\\sum\s(.+?)3/; // Assuming \sum and 3

      // Extract the core of the hint, replace for "={}"
      for (let i = 0; i < toVerify.length; i++) {
        const match = regex.exec(toVerify[i]);

        // Is likely a hint
        if (match) {
          toVerify[i] = match[1].replace(/[{}]/g, ""); // Remove any braces
          console.log("TO VERIFY: ", toVerify[i]);

          // Match any character that is not a backslash or a closing brace; replace for proper formatting
          const modifiedHints = toVerify.map(
            (str) => `=\\{${str.replace(/([^\\}])/g, "$1")}\\}`
          );
          console.log("Modified Hints: ", modifiedHints);
          for (let i = 1; i < results.length; i += 2) {
            results[i] = modifiedHints[(i - 1) / 2];
          }
        }
      }

      for (let i = 0; i < results.length; i++) {
        results[i] = results[i].replace(/=_/g, "=");
      }
    }

    console.log("RESULTS: ", results);

    res.send(results);
  } catch (error) {
    console.error(`Error executing commands: ${error}`);
    res.status(500).send("Internal Server Error");
  }
}

async function handlePost(req, res) {
  const data = req.body.toString();
  const fileName = "temp.inkml";
  const filePath = path.join(path.resolve(`${PATH}/temp`), fileName);

  if (PROOF_MODE) {
    const tracesAllInfo = await calculateAverageY(data);
    calculateLineNumber(tracesAllInfo);
    // Assume based on threshold that there are multiple lines, independant of their content
    const inkMLObjects = createInkMLObjects(tracesAllInfo, THRESHOLD);
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
}

module.exports = router;
