const fs = require("fs").promises;
const path = require("path");
const xml2js = require("xml2js");
const { PATH } = require("./constants");

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
 * Sorts an array of objects containing information about the traces, groups the objects by lineNumber,
 * and creates an InkML string for each group. Then returns an object containing each InkML string separately
 * with lineNumber being the key.
 *
 * @param {Array} tracesAllInfo - An array of objects with all information of the traces:
 *   @property {number} lineNumber - The line number of the trace.
 *   @property {number} traceId - The ID of the trace.
 *   @property {Array} coords - An array of coordinate values for the trace, in the form [x1, y1, x2, y2, ..., xn, yn].
 * @returns {Object} An object containing each InkML string
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
module.exports = {
  writeInkMLFiles,
  createInkMLObjects,
  extractAllInformation,
  createFileFromInfo,
};
