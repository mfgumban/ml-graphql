'use strict';

const parser = require('language/parser.sjs');

function graphql(source, schema) {
  // validate schema (should only do once or during registration)
  // validateSchema(schema);

  // parse input
  let document = null;
  try {
    document = parser.parse(source);
  }
  catch(error) {
    return { errors: [error] };
  }

  // validate input
  // const validationErrors = 

  // execute
  return {};
}