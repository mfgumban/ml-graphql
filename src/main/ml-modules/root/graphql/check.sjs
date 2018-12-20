'use strict';

function notNull(obj, errorMsg) {
  if (obj === null || obj === undefined) {
    throw new Error(errorMsg || 'Object expected to be not null or undefined');
  }
  return true;
}

function isTrue(expr, errorMsg) {
  if (!expr) {
    throw new Error(errorMsg);
  }
  return true;
}

function objectType(obj, classType, errorMsg) {
  if (notNull(obj) && !(obj instanceof classType)) {
    throw new TypeError(errorMsg || `Expected type ${classType.prototype.constructor.name} but was ${obj.constructor.name}`);
  }
  return true;
}

module.exports = {
  notNull: notNull,
  isTrue: isTrue,
  objectType: objectType
};