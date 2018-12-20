'use strict';

const check = require('../check.sjs');

class Location {
  constructor(line, column) {
    this.line = line;
    this.column = column;
  }
}

class Source {
  constructor(body, name, locationOffset) {
    this.body = body;
    this.name = name || 'GraphQL Request';
    this.locationOffset = locationOffset || new Location(1, 1);
    
    check.objectType(this.locationOffset, Location);
    check.isTrue(this.locationOffset.line > 0, 'line in locationOffset is 1-indexed and must be positive');
    check.isTrue(this.locationOffset.column > 0, 'column in locationOffset is 1-indexed and must be positive');
  }
}

module.exports = {
  Location: Location,
  Source: Source
};