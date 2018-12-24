'use strict';

const test = require('/test/test-helper.xqy');
const GraphQLError = require('/graphql/error/error.sjs').GraphQLError;
const Source = require('/graphql/language/source.sjs').Source;
const Lexer = require('/graphql/language/lexer.sjs').Lexer;

function lexOne(str) {
  const lexer = new Lexer(new Source(str));
  return lexer.advance();
}

function assertThrowsSyntaxError(input, expectedMessage, location) {
  try {
    lexOne(input);
  }
  catch(error) {
    if (!(error instanceof GraphQLError)) {
      fn.error(xs.QName('ASSERT-THROWS-SYNTAX-ERROR-FAILED'), 'Catched exception was not a GraphQLError.', error);
    }
    else if (error instanceof GraphQLError && error.message !== `Syntax Error: ${expectedMessage}`) {
      fn.error(xs.QName('ASSERT-THROWS-SYNTAX-ERROR-FAILED'), 'Message or location does not match.', error);
    }
    else {
      return test.success();
    }
  }
}

function DisallowUncommonControlCharacters() {
  return assertThrowsSyntaxError(
    '\u0007',
    'Cannot contain the invalid character "\\u0007".',
    { line: 1, column: 1 });
}

[].concat(
  DisallowUncommonControlCharacters()
);