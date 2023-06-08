const { log } = require("console");
const { exec } = require("child_process");
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const util = require("util");
const xml2js = require("xml2js");
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
    xml2js.parseString(xml, (err, result) => {
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

/* // We consider two strokes are in one line when either one of their centers hits in another stroke bounding box,
// but resized to 50% of its height
function isOneLine(s, sseg) {
  return true;
}

// And we confirm the vertical relation of two strokes
// if they can have subscript/superscript or upper/lower relative positioning
function isVerticalRelation(s, sseg) {
  return true;
}

// Merging process includes insertion of the stroke index to other segment strokes indexes to
// preserve the initial strokes order, and calculation of the union of their bounding boxes.
function mergeToSegment(s, M) {
  console.log("CALLED");
}

function calculateDTD(tracesAllInfo) {
  return 10;
}

function calculateLineNumber(S) {
  console.log("TRACES ALL INFO: ", S);

  let R = [[]];
  const firstTrace = S.find((obj) => obj.traceId === 0);
  R[0].push(firstTrace);

  console.log("R: ", R);

  let DTD = calculateDTD(S);

  for (let s of S) {
    let M = [];

    for (let seg of R) {
      for (let sseg of seg) {
        if (isOneLine(s, sseg)) {
          M.push(seg);
        } else if (isVerticalRelation(s, sseg)) {
          if (distance(s, sseg) < DTD) {
            M.push(seg);
          }
        }
      }
    }
    if (M.length === 0) {
      R.push([s]); // Create new segment
    } else {
      mergeToSegment(s, M);
    }
  }
  return R;
}
 */
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
      `cd ${PATH} && ./seshat -c Config/CONFIG -i temp/temp${number}.inkml -o out/out${number}.inkml -r render.pgm -d out.dot`
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

/**
 * Processes the inkml, extracting relevant information.
 * @param {string} filePath - The path of the file to process.
 * @returns {Promise<Object>} - A Promise that resolves to an object containing the processed file information.
 */
async function processFile(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    const result = await xml2js.parseStringPromise(fileContent);
    const outFileInfo = {
      traces: [],
      mathString: null,
      traceGroups: {},
    };

    // Extract traces
    outFileInfo.traces = result.ink.trace.map((trace) => ({
      id: trace.$.id,
      coordinates: trace._.replace(/\n/g, ""),
    }));

    // Extract math tags and content
    const mathMatch = /<math[^>]*>(.*?)<\/math>/s.exec(fileContent);
    outFileInfo.mathString = mathMatch ? mathMatch[1] : null;

    const traceGroups = result.ink.traceGroup[0].traceGroup;

    for (const group of traceGroups) {
      const id = group["$"]["xml:id"];
      const traceViews = group.traceView;

      const traceDataRefs = traceViews.map(
        (traceView) => traceView.$.traceDataRef
      );
      const symbolID = group.annotationXML[0].$.href;

      outFileInfo.traceGroups[id] = { traceDataRefs, symbolID };
    }

    return outFileInfo;
  } catch (err) {
    console.error(`Error processing file ${filePath}: ${err}`);
  }
}

/**
 * Extracts information from files the list of last written files.
 *
 * @param {number[]} lastWrittenNumbers - An array of numbers representing the last written files.
 * @returns {Promise<Object>} A promise that resolves to an object containing the extracted information from files.
 */
async function extractAllInformation(lastWrittenNumbers) {
  const outFilesAllInfo = {};
  const folderPath = path.join(PATH, "out");

  try {
    const files = await fs.readdir(folderPath);
    const filePromises = files
      .filter((file) => {
        const numberMatch = file.match(/\d+/);
        if (numberMatch) {
          const fileNumber = parseInt(numberMatch[0]);
          return lastWrittenNumbers.includes(fileNumber);
        }
        return false;
      })
      .map((file) => {
        const filePath = path.join(folderPath, file);
        return processFile(filePath).then((outFileInfo) => ({
          fileName: file,
          outFileInfo,
        }));
      });

    const results = await Promise.all(filePromises);

    results.forEach(({ fileName, outFileInfo }) => {
      outFilesAllInfo[fileName] = outFileInfo;
    });

    return outFilesAllInfo;
  } catch (err) {
    console.error(`Error reading directory ${folderPath}: ${err}`);
  }
}

function createTraceXML(trace) {
  return `<trace id="${trace.id}">${trace.coordinates}</trace>\n`;
}

/**
 * Helper function.
 * @param {Object} traceGroup - Trace group with traceDataRefs and symbolID.
 * @returns {string} - XML string for the trace group.
 */
function createTraceGroupXML(traceGroup) {
  let traceGroupXML = `<traceGroup xml:id="${traceGroup.symbolID}">\n`;
  traceGroupXML += `<annotation type="truth">${traceGroup.symbolID}</annotation>\n`;

  traceGroup.traceDataRefs.forEach((ref) => {
    traceGroupXML += `<traceView traceDataRef="${ref}"/>\n`;
  });

  traceGroupXML += "</traceGroup>\n";
  return traceGroupXML;
}

/**
 * Generate InkML file content from given information.
 * @param {Object} outFileAllInfo - Object containing all necessary information to create an InkML file.
 * @returns {String} - String containing the final inkml
 */
function createFileFromInfo(outFileAllInfo) {
  let inkmlString = '<ink xmlns="http://www.w3.org/2003/InkML">\n';
  inkmlString += '<annotation type="UI"></annotation>\n';
  inkmlString += '<annotationXML type="truth" encoding="Content-MathML">\n';

  let mathMLString = "";
  let counter = 1;

  for (const filename in outFileAllInfo) {
    const fileInfo = outFileAllInfo[filename];
    const dataType = counter % 2 === 0 ? "hint" : "exp";

    mathMLString += `<math xmlns="http://www.w3.org/1998/Math/MathML" data-type="${dataType}">`;
    mathMLString += fileInfo.mathString;
    mathMLString += "</math>\n";
    counter++;
  }

  inkmlString += mathMLString;
  inkmlString += "</annotationXML>\n";

  for (const filename in outFileAllInfo) {
    const fileInfo = outFileAllInfo[filename];
    const traces = fileInfo.traces;

    traces.forEach((trace) => {
      inkmlString += createTraceXML(trace);
    });
  }

  for (const filename in outFileAllInfo) {
    const fileInfo = outFileAllInfo[filename];
    const traceGroups = fileInfo.traceGroups;

    for (const traceGroupID in traceGroups) {
      const traceGroup = traceGroups[traceGroupID];
      inkmlString += createTraceGroupXML(traceGroup);
    }
  }

  inkmlString += "</ink>";

  // Write to the file
  fs.writeFile(path.join(PATH, "out", "outFinal.inkml"), inkmlString, (err) => {
    if (err) throw err;
    console.log("The file has been saved!");
  });

  return inkmlString;
}

/**
 * Updates IDs for trace groups to be unique across all files
 * */
function assignUniqueTraceGroupIDs(traceGroups, groupIdCounter) {
  const updatedTraceGroups = {};

  for (const group in traceGroups) {
    if (traceGroups.hasOwnProperty(group)) {
      updatedTraceGroups[String(groupIdCounter)] = { ...traceGroups[group] };
      groupIdCounter++;
    }
  }

  return { updatedTraceGroups, groupIdCounter };
}

/**
 * Updates traceDataRefs the traceGroups based on the provided changes
 */
function updateTraceDataRefs(traceGroups, traceIdChanges) {
  const updatedTraceGroups = {};

  for (const group in traceGroups) {
    if (traceGroups.hasOwnProperty(group)) {
      const groupData = { ...traceGroups[group] };
      groupData.traceDataRefs = groupData.traceDataRefs.map(
        (ref) => traceIdChanges[ref]
      );
      updatedTraceGroups[group] = groupData;
    }
  }

  return updatedTraceGroups;
}
/**
 * Updates trace IDs to be unique across all files.
 */
function assignUniqueTraceIDs(traces, traceIdCounter) {
  return {
    updatedTraces: traces.map((trace) => {
      const newTrace = { ...trace, id: String(traceIdCounter) };
      traceIdCounter++;
      return newTrace;
    }),
    traceIdCounter,
  };
}

/**
 * Ensures that all IDs are unique
 *
 * @param {Object} outFileAllInfo - All data
 * @returns {Object} The outFileAllInfo with updated to be unique in all files
 */
function modifyIDsToUnique(outFileAllInfo) {
  const modifiedInfo = JSON.parse(JSON.stringify(outFileAllInfo));
  let traceIdCounter = 1;
  let groupIdCounter = 1;

  for (const outFile in modifiedInfo) {
    if (modifiedInfo.hasOwnProperty(outFile)) {
      const inkmlData = modifiedInfo[outFile];

      // Traces
      const { updatedTraces, traceIdCounter: newTraceIdCounter } =
        assignUniqueTraceIDs(inkmlData.traces, traceIdCounter);
      traceIdCounter = newTraceIdCounter; // Need to preserve counter across files

      const traceIdChanges = updatedTraces.reduce((acc, trace, i) => {
        acc[inkmlData.traces[i].id] = trace.id;
        return acc;
      }, {});

      // TraceDataRefs
      const updatedTraceGroups = updateTraceDataRefs(
        inkmlData.traceGroups,
        traceIdChanges
      );

      // TraceGroups
      const {
        updatedTraceGroups: finalTraceGroups,
        groupIdCounter: newGroupIdCounter,
      } = assignUniqueTraceGroupIDs(updatedTraceGroups, groupIdCounter);
      groupIdCounter = newGroupIdCounter;

      inkmlData.traces = updatedTraces;
      inkmlData.traceGroups = finalTraceGroups;
    }
  }

  return modifiedInfo;
}


function modifyMathTag(mathTag) {
  console.log("MATH TAG: ", mathTag);

  const mrowTags = mathTag.mrow;

  for (let i = 0; i < mrowTags.length; i++) {
    const mrowTag = mrowTags[i];
    const moTag = mrowTag.mo;
    const mnTag = mrowTag.mn;

    if (moTag && moTag[0] === "=" && mnTag && mnTag[mnTag.length - 1] === "3") {
      mrowTag.mo[0] = "=";
      mrowTag.mn[mnTag.length - 1] = "}";
      modifyMsubTag(mrowTag);
    }
  }
}

function modifyMsubTag(mrowTag) {
  const msubTag = mrowTag.msub;

  if (msubTag && msubTag.length > 0) {
    const mrowTagIndex = msubTag.findIndex((subTag) => subTag.mrow);
    if (mrowTagIndex !== -1) {
      const mrowTag = msubTag[mrowTagIndex].mrow[0];
      if (mrowTag) {
        mrowTag.mo[0] = "{";
        mrowTag.mn[mrowTag.mn.length - 1] = "}";
      }
    }
  }
}

async function assembleSingleInkML(lastWrittenNumbers) {
  const outFilesAllInfo = await extractAllInformation(lastWrittenNumbers);

  const uniqueIDsInfo = modifyIDsToUnique(outFilesAllInfo);

  createFileFromInfo(uniqueIDsInfo);

  //const finalString = await modifySumAnd3(outInkMLString);

  //console.log("FINAL STRING: ", finalString);
}

/********************** GET + POST HANDLERS ******************************/

async function handleMultipleLines(req, res) {
  try {
    const lastWrittenNumbers = Array.from(req.query.lastWrittenNumbers, Number);
    const seshatCommands = buildSeshatCommands(lastWrittenNumbers);

    let results = await Promise.all(
      seshatCommands.map(async (command) => {
        const { stdout, stderr } = await util.promisify(exec)(command);
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          throw new Error("Internal Server Error");
        }
        const latexExpression = extractLatexExpression(stdout);
        return latexExpression.replace(/ COMMA /g, ", ");
      })
    );

    // Get odd-indexed elements that match with regex
    const hintMatches = results
      .filter((_, i) => i % 2 !== 0)
      .map((result) =>
        /(=|\\lt|\\gt|\\leq|\\geq)_{((\\sum\s*(.*?))|(\\{(.+?)\\}))}3?/.exec(
          result
        )
      )
      .filter((match) => match !== null);

    console.log("HINT MATCHES: ", hintMatches);

    const regex =
      /(=|\\lt|\\gt|\\leq|\\geq)_{((\\sum\s*(.*?))|(\\{(.+?)\\}))}3?/;

    for (let [index, result] of results.entries()) {
      // Only odd-indexed results matter (the hint)
      if (index % 2 === 0) continue;

      let match = regex.exec(result);

      if (!match) continue;

      let operator = match[1];
      let hint = match[6] ? match[6].trim() : match[4].replace(/3$/, "").trim();

      // Build the modified hint and replace
      let modifiedHint = `${operator}\\{${hint}\\}`;
      results[index] = modifiedHint;
    }

    results = results.map(
      (result) =>
        result
          .replace(/=_/g, "=") // Remove any underscore
          .replace(/=\{\\{(.+?)\\}\}/g, "={$1}") // Remove extra braces
          .replace(/(_=|_\\lt|_\\gt|_\\leq|_\\geq)/g, (m) => m.slice(1)) // Remove underscore before operators
    );

    console.log("RESULTS: ", results);

    await assembleSingleInkML(lastWrittenNumbers);

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
