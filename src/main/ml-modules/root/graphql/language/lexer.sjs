'use strict';

const check = require('../check.sjs');
const syntaxError = require('../error.sjs').syntaxError;
const blockStringValue = require('blockStringValue.sjs').blockStringValue;
const Source = require('source.sjs').Source;

const charCodeAt = String.prototype.charCodeAt;
const slice = Array.prototype.slice;

const TokenKind = Object.freeze({
  SOF: '<SOF>',
  EOF: '<EOF>',
  BANG: '!',
  DOLLAR: '$',
  AMP: '&',
  PAREN_L: '(',
  PAREN_R: ')',
  SPREAD: '...',
  COLON: ':',
  EQUALS: '=',
  AT: '@',
  BRACKET_L: '[',
  BRACKET_R: ']',
  BRACE_L: '{',
  PIPE: '|',
  BRACE_R: '}',
  NAME: 'Name',
  INT: 'Int',
  FLOAT: 'Float',
  STRING: 'String',
  BLOCK_STRING: 'BlockString',
  COMMENT: 'Comment',
});

class Token {
  constructor(kind, start, end, line, column, prev, value) {
    this.kind = kind;
    this.start = start;
    this.end = end;
    this.line = line;
    this.column = column;
    this.prev = prev || null;
    this.next = null;
    this.value = value;
  }

  getTokenDesc() {
    return this.value ? `${this.kind} "${this.value}"` : this.kind;
  }
}

class Lexer {
  constructor(source, options) {
    check.objectType(source, Source);

    let sofToken = new Token(TokenKind.SOF, 0, 0, 0, 0, null);
    this.source = source;
    this.options = options;
    this.lastToken = sofToken;
    this.token = sofToken;
    this.line = 1;
    this.lineStart = 0;
  }

  advance() {
    this.lastToken = this.token;
    this.token = this.lookahead();
    return this.token;
  }

  lookahead() {
    let token = this.token;
    if (token.kind !== TokenKind.EOF) {
      do {
        token = token.next || readToken(this, token);
      } while (token.kind === TokenKind.COMMENT);
    }
    return token;
  }
}

function readToken(lexer, prev) {
  const source = lexer.source;
  const body = source.body;
  const bodyLength = body.length;

  const pos = positionAfterWhitespace(body, prev.end, lexer);
  const line = lexer.line;
  const col = 1 + pos - lexer.lineStart;

  if (pos >= bodyLength) {
    return new Token(TokenKind.EOF, bodyLength, bodyLength, line, col, prev);
  }

  const code = charCodeAt.call(body, pos);

  switch(code) {
    case 33: // !
      return new Token(TokenKind.BANG, pos, pos + 1, line, col, prev);
    case 35: // #
      return readComment(source, pos, line, col, prev);
    case 36: // $
      return new Token(TokenKind.DOLLAR, pos, pos + 1, line, col, prev);
    case 38: // &
      return new Token(TokenKind.AMP, pos, pos + 1, line, col, prev);
    case 40: // (
      return new Token(TokenKind.PAREN_L, pos, pos + 1, line, col, prev);
    case 41: // )
      return new Token(TokenKind.PAREN_R, pos, pos + 1, line, col, prev);
    case 46: // .
      if (charCodeAt.call(body, pos + 1) === 46 && charCodeAt.call(body, pos + 2) === 46) {
        return new Token(TokenKind.SPREAD, pos, pos + 3, line, col, prev);
      }
      break;
    case 58: // :
      return new Token(TokenKind.COLON, pos, pos + 1, line, col, prev);
    case 61: // =
      return new Token(TokenKind.EQUALS, pos, pos + 1, line, col, prev);
    case 64: // @
      return new Token(TokenKind.AT, pos, pos + 1, line, col, prev);
    case 91: // [
      return new Token(TokenKind.BRACKET_L, pos, pos + 1, line, col, prev);
    case 93: // ]
      return new Token(TokenKind.BRACKET_R, pos, pos + 1, line, col, prev);
    case 123: // {
      return new Token(TokenKind.BRACE_L, pos, pos + 1, line, col, prev);
    case 124: // |
      return new Token(TokenKind.PIPE, pos, pos + 1, line, col, prev);
    case 125: // }
      return new Token(TokenKind.BRACE_R, pos, pos + 1, line, col, prev);
    // A-Z _ a-z
    case 65:
    case 66:
    case 67:
    case 68:
    case 69:
    case 70:
    case 71:
    case 72:
    case 73:
    case 74:
    case 75:
    case 76:
    case 77:
    case 78:
    case 79:
    case 80:
    case 81:
    case 82:
    case 83:
    case 84:
    case 85:
    case 86:
    case 87:
    case 88:
    case 89:
    case 90:
    case 95:
    case 97:
    case 98:
    case 99:
    case 100:
    case 101:
    case 102:
    case 103:
    case 104:
    case 105:
    case 106:
    case 107:
    case 108:
    case 109:
    case 110:
    case 111:
    case 112:
    case 113:
    case 114:
    case 115:
    case 116:
    case 117:
    case 118:
    case 119:
    case 120:
    case 121:
    case 122:
      return readName(source, pos, line, col, prev);
    // - 0-9
    case 45:
    case 48:
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
    case 55:
    case 56:
    case 57:
      return readNumber(source, pos, code, line, col, prev);
    case 34: // "
      if (charCodeAt.call(body, pos + 1) === 34 && charCodeAt.call(body, pos + 2) === 34) {
        return readBlockString(source, pos, line, col, prev);
      }
      return readString(source, pos, line, col, prev);
  }

  throw syntaxError(source, pos, unexpectedCharacterMessage(code));
}

function unexpectedCharacterMessage(code) {
  if (code < 0x0020 && code !== 0x0009 && code !== 0x000a && code !== 0x000d) {
    return `Cannot contain the invalid character ${printCharCode(code)}.`;
  }

  if (code === 39) {
    // '
    return (
      "Unexpected single quote character ('), did you mean to use " +
      'a double quote (")?'
    );
  }

  return `Cannot parse the unexpected character ${printCharCode(code)}.`;
}

function printCharCode(code) {
  return (
    // NaN/undefined represents access beyond the end of the file.
    isNaN(code)
      ? TokenKind.EOF
      : // Trust JSON for ASCII.
      code < 0x007f
      ? JSON.stringify(String.fromCharCode(code))
      : // Otherwise print the escaped form.
        `"\\u${('00' + code.toString(16).toUpperCase()).slice(-4)}"`
  );
}

function positionAfterWhitespace(body, startPosition, lexer) {
  const bodyLength = body.length;
  let position = startPosition;
  while (position < bodyLength) {
    const code = charCodeAt.call(body, position);
    // tab | space | comma | BOM
    if (code === 9 || code === 32 || code === 44 || code === 0xfeff) {
      ++position;
    } else if (code === 10) {
      // new line
      ++position;
      ++lexer.line;
      lexer.lineStart = position;
    } else if (code === 13) {
      // carriage return
      if (charCodeAt.call(body, position + 1) === 10) {
        position += 2;
      } else {
        ++position;
      }
      ++lexer.line;
      lexer.lineStart = position;
    } else {
      break;
    }
  }
  return position;
}

function readComment(source, start, line, col, prev) {
  const body = source.body;
  let code;
  let position = start;

  do {
    code = charCodeAt.call(body, ++position);
  } while (
    // SourceCharacter but not LineTerminator
    code !== null && (code > 0x001f || code === 0x0009)
  );

  return new Token(
    TokenKind.COMMENT,
    start,
    position,
    line,
    col,
    prev,
    slice.call(body, start + 1, position)
  );
}

function readNumber(source, start, firstCode, line, col, prev) {
  const body = source.body;
  let code = firstCode;
  let position = start;
  let isFloat = false;

  if (code === 45) {
    // -
    code = charCodeAt.call(body, ++position);
  }

  if (code === 48) {
    // 0
    code = charCodeAt.call(body, ++position);
    if (code >= 48 && code <= 57) {
      throw syntaxError(
        source,
        position,
        `Invalid number, unexpected digit after 0: ${printCharCode(code)}.`
      );
    }
  } else {
    position = readDigits(source, position, code);
    code = charCodeAt.call(body, position);
  }

  if (code === 46) {
    // .
    isFloat = true;

    code = charCodeAt.call(body, ++position);
    position = readDigits(source, position, code);
    code = charCodeAt.call(body, position);
  }

  if (code === 69 || code === 101) {
    // E e
    isFloat = true;

    code = charCodeAt.call(body, ++position);
    if (code === 43 || code === 45) {
      // + -
      code = charCodeAt.call(body, ++position);
    }
    position = readDigits(source, position, code);
  }

  return new Token(
    isFloat ? TokenKind.FLOAT : TokenKind.INT,
    start,
    position,
    line,
    col,
    prev,
    slice.call(body, start, position)
  );
}

function readDigits(source, start, firstCode) {
  const body = source.body;
  let position = start;
  let code = firstCode;
  if (code >= 48 && code <= 57) {
    // 0 - 9
    do {
      code = charCodeAt.call(body, ++position);
    } while (code >= 48 && code <= 57); // 0 - 9
    return position;
  }
  throw syntaxError(
    source,
    position,
    `Invalid number, expected digit but got: ${printCharCode(code)}.`
  );
}

function readString(source, start, line, col, prev) {
  const body = source.body;
  let position = start + 1;
  let chunkStart = position;
  let code = 0;
  let value = '';

  while (
    position < body.length &&
    (code = charCodeAt.call(body, position)) !== null &&
    // not LineTerminator
    code !== 0x000a &&
    code !== 0x000d
  ) {
    // Closing Quote (")
    if (code === 34) {
      value += slice.call(body, chunkStart, position);
      return new Token(
        TokenKind.STRING,
        start,
        position + 1,
        line,
        col,
        prev,
        value
      );
    }

    // SourceCharacter
    if (code < 0x0020 && code !== 0x0009) {
      throw syntaxError(
        source,
        position,
        `Invalid character within String: ${printCharCode(code)}.`
      );
    }

    ++position;
    if (code === 92) {
      // \
      value += slice.call(body, chunkStart, position - 1);
      code = charCodeAt.call(body, position);
      switch (code) {
        case 34:
          value += '"';
          break;
        case 47:
          value += '/';
          break;
        case 92:
          value += '\\';
          break;
        case 98:
          value += '\b';
          break;
        case 102:
          value += '\f';
          break;
        case 110:
          value += '\n';
          break;
        case 114:
          value += '\r';
          break;
        case 116:
          value += '\t';
          break;
        case 117: // u
          const charCode = uniCharCode(
            charCodeAt.call(body, position + 1),
            charCodeAt.call(body, position + 2),
            charCodeAt.call(body, position + 3),
            charCodeAt.call(body, position + 4)
          );
          if (charCode < 0) {
            throw syntaxError(
              source,
              position,
              'Invalid character escape sequence: ' +
              `\\u${body.slice(position + 1, position + 5)}.`
            );
          }
          value += String.fromCharCode(charCode);
          position += 4;
          break;
        default:
          throw syntaxError(
            source,
            position,
            `Invalid character escape sequence: \\${String.fromCharCode(code)}.`
          );
      }
      ++position;
      chunkStart = position;
    }
  }

  throw syntaxError(source, position, 'Unterminated string.');
}

function readBlockString(source, start, line, col, prev) {
  const body = source.body;
  let position = start + 3;
  let chunkStart = position;
  let code = 0;
  let rawValue = '';

  while (
    position < body.length &&
    (code = charCodeAt.call(body, position)) !== null
  ) {
    // Closing Triple-Quote (""")
    if (
      code === 34 &&
      charCodeAt.call(body, position + 1) === 34 &&
      charCodeAt.call(body, position + 2) === 34
    ) {
      rawValue += slice.call(body, chunkStart, position);
      return new Token(
        TokenKind.BLOCK_STRING,
        start,
        position + 3,
        line,
        col,
        prev,
        blockStringValue(rawValue)
      );
    }

    // SourceCharacter
    if (
      code < 0x0020 &&
      code !== 0x0009 &&
      code !== 0x000a &&
      code !== 0x000d
    ) {
      throw syntaxError(
        source,
        position,
        `Invalid character within String: ${printCharCode(code)}.`
      );
    }

    // Escape Triple-Quote (\""")
    if (
      code === 92 &&
      charCodeAt.call(body, position + 1) === 34 &&
      charCodeAt.call(body, position + 2) === 34 &&
      charCodeAt.call(body, position + 3) === 34
    ) {
      rawValue += slice.call(body, chunkStart, position) + '"""';
      position += 4;
      chunkStart = position;
    } else {
      ++position;
    }
  }

  throw syntaxError(source, position, 'Unterminated string.');
}

function uniCharCode(a, b, c, d) {
  return (
    (char2hex(a) << 12) | (char2hex(b) << 8) | (char2hex(c) << 4) | char2hex(d)
  );
}

function char2hex(a) {
  return a >= 48 && a <= 57
    ? a - 48 // 0-9
    : a >= 65 && a <= 70
    ? a - 55 // A-F
    : a >= 97 && a <= 102
    ? a - 87 // a-f
    : -1;
}

function readName(source, start, line, col, prev) {
  const body = source.body;
  const bodyLength = body.length;
  let position = start + 1;
  let code = 0;
  while (
    position !== bodyLength &&
    (code = charCodeAt.call(body, position)) !== null &&
    (code === 95 || // _
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122)) // a-z
  ) {
    ++position;
  }
  return new Token(
    TokenKind.NAME,
    start,
    position,
    line,
    col,
    prev,
    slice.call(body, start, position)
  );
}

module.exports = {
  TokenKind: TokenKind,
  Token: Token,
  Lexer: Lexer
};