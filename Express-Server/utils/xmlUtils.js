const xml2js = require("xml2js");

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

module.exports = { parseXml };
