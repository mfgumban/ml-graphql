'use strict';

function isInvalid(value) {
  return value === undefined || value !== value;
}

module.exports = {
  isInvalid: isInvalid
};