'use strict';

const test = require('/test/test-helper.xqy');
const GraphQLError = require('/graphql/error.sjs').GraphQLError;
const Source = require('/graphql/language/source.sjs').Source;
const Lexer = require('/graphql/language/lexer.sjs').Lexer;

function lexOne(str) {
  const lexer = new Lexer(new Source(str));
  return lexer.advance();
}

function assertThrowsSyntaxError(input, message, location) {
  try {
    return test.assertThrowsError(() => {
      lexOne(input);
    });
  }
  catch(error) {
    if (!(error instanceof GraphQLError)) {
      fn.error(xs.QName('ASSERT-THROWS-SYNTAX-ERROR-FAILED'), message);
    }
    else {
      return test.success();
    }
  }
}

let results = [];

results = results.concat(
  (function DisallowUncommonControlCharacters() {
    return assertThrowsSyntaxError(
      '\u0007',
      'Cannot contain the invalid character "\\u0007".',
      { line: 1, column: 1 });
  })()
);

results;
