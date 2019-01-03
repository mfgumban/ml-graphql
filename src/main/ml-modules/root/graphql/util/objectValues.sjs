'use strict';

function objectValues(obj) {
  return obj.values || Object.keys(obj).map(key => obj[key]);
}

module.exports = {
  objectValues: objectValues
};