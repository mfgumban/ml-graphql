'use strict';

class GraphQLError extends Error {
  constructor(message, nodes, source, positions, path, originalError, extensions) {
    super(message);
    this.nodes = nodes;
    this.source = source;
    this.positions = positions;
    this.path = path;
    this.originalError = originalError;
    this.extensions = extensions;
  }
}

function syntaxError(source, position, description) {
  return new GraphQLError(
    `Syntax Error: ${description}`,
    undefined,
    source,
    position);
}

module.exports = {
  syntaxError: syntaxError
}