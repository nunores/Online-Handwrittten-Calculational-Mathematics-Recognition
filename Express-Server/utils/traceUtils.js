const { parseXml } = require("./xmlUtils");
const { THRESHOLD } = require("./constants");

/**
 * Calculates the average Y coordinate for each trace in the given data set.
 * @param {string} data - The data set to process.
 * @returns {Promise<Array>} - An array of objects containing the trace ID, average Y, and the coordinates.
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
 * Extracts the coordinates from the given trace.
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
 * Calculates the line number of each object in an array based on a threshold.
 *
 * @param {Array} tracesAllInfo - An array of objects containing a `yAverage` property.
 * @returns {void}
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

module.exports = {
  calculateAverageY,
  extractCoordinates,
  calculateAverageYCoordinate,
  calculateLineNumber,
};
