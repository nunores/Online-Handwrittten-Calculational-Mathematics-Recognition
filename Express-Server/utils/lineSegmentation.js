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