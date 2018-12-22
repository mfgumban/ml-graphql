'use strict';

const check = require('../check.sjs');
const syntaxError = require('../error/error.sjs').syntaxError;
const Source = require('source.sjs').Source;
const ast = require('ast.sjs');
const lxr = require('lexer.sjs');

const Lexer = lxr.Lexer;
const TokenKind = lxr.TokenKind;
const NodeKind = ast.NodeKind;
const DirectiveLocation = ast.DirectiveLocation;

function createLexer(source, options) {
  return new Lexer(source, options);
}

function parse(source, options) {
  const sourceObj = typeof source === 'string' ? new Source(source) : source;
  check.objectType(sourceObj, Source);
  const lexer = createLexer(sourceObj, options || {});
  return parseDocument(lexer);
}

function parseValue(source, options) {
  const sourceObj = typeof source === 'string' ? new Source(source) : source;
  const lexer = createLexer(sourceObj, options || {});
  expect(lexer, TokenKind.SOF);
  const value = parseValueLiteral(lexer, false);
  expect(lexer, TokenKind.EOF);
  return value;
}

function parseType(source, options) {
  const sourceObj = typeof source === 'string' ? new Source(source) : source;
  const lexer = createLexer(sourceObj, options || {});
  expect(lexer, TokenKind.SOF);
  const type = parseTypeReference(lexer);
  expect(lexer, TokenKind.EOF);
  return type;
}

function parseName(lexer) {
  const token = expect(lexer, TokenKind.NAME);
  return {
    kind: NodeKind.NAME,
    value: token.value.toString(),
    loc: loc(lexer, token)
  };
}

function parseDocument(lexer) {
  const start = lexer.token;
  return {
    kind: NodeKind.DOCUMENT,
    definitions: many(lexer, TokenKind.SOF, parseDefinition, TokenKind.EOF),
    loc: loc(lexer, start)
  };
}

function parseDefinition(lexer) {
  if (peek(lexer, TokenKind.NAME)) {
    switch (lexer.token.value) {
      case 'query':
      case 'mutation':
      case 'subscription':
      case 'fragment':
        return parseExecutableDefinition(lexer);
      case 'schema':
      case 'scalar':
      case 'type':
      case 'interface':
      case 'union':
      case 'enum':
      case 'input':
      case 'directive':
        return parseTypeSystemDefinition(lexer);
      case 'extend':
        return parseTypeSystemExtension(lexer);
    }
  } else if (peek(lexer, TokenKind.BRACE_L)) {
    return parseExecutableDefinition(lexer);
  } else if (peekDescription(lexer)) {
    return parseTypeSystemDefinition(lexer);
  }

  throw unexpected(lexer);
}

function parseExecutableDefinition(lexer) {
  if (peek(lexer, TokenKind.NAME)) {
    switch (lexer.token.value) {
      case 'query':
      case 'mutation':
      case 'subscription':
        return parseOperationDefinition(lexer);

      case 'fragment':
        return parseFragmentDefinition(lexer);
    }
  } else if (peek(lexer, TokenKind.BRACE_L)) {
    return parseOperationDefinition(lexer);
  }

  throw unexpected(lexer);
}

function parseOperationDefinition(lexer) {
  const start = lexer.token;
  if (peek(lexer, TokenKind.BRACE_L)) {
    return {
      kind: NodeKind.OPERATION_DEFINITION,
      operation: 'query',
      name: undefined,
      variableDefinitions: [],
      directives: [],
      selectionSet: parseSelectionSet(lexer),
      loc: loc(lexer, start)
    };
  }
  const operation = parseOperationType(lexer);
  let name;
  if (peek(lexer, TokenKind.NAME)) {
    name = parseName(lexer);
  }
  return {
    kind: NodeKind.OPERATION_DEFINITION,
    operation,
    name,
    variableDefinitions: parseVariableDefinitions(lexer),
    directives: parseDirectives(lexer, false),
    selectionSet: parseSelectionSet(lexer),
    loc: loc(lexer, start)
  };
}

function parseOperationType(lexer) {
  const operationToken = expect(lexer, TokenKind.NAME);
  switch (operationToken.value) {
    case 'query':
      return 'query';
    case 'mutation':
      return 'mutation';
    case 'subscription':
      return 'subscription';
  }

  throw unexpected(lexer, operationToken);
}

function parseVariableDefinitions(lexer) {
  return peek(lexer, TokenKind.PAREN_L) ? 
    many(lexer, TokenKind.PAREN_L, parseVariableDefinition, TokenKind.PAREN_R) : 
    [];
}

function parseVariableDefinition(lexer) {
  const start = lexer.token;
  return {
    kind: NodeKind.VARIABLE_DEFINITION,
    variable: parseVariable(lexer),
    type: (expect(lexer, TokenKind.COLON), parseTypeReference(lexer)),
    defaultValue: skip(lexer, TokenKind.EQUALS) ? parseValueLiteral(lexer, true) : undefined,
    directives: parseDirectives(lexer, true),
    loc: loc(lexer, start)
  };
}

function parseVariable(lexer) {
  const start = lexer.token;
  expect(lexer, TokenKind.DOLLAR);
  return {
    kind: NodeKind.VARIABLE,
    name: parseName(lexer),
    loc: loc(lexer, start)
  };
}

function parseSelectionSet(lexer) {
  const start = lexer.token;
  return {
    kind: NodeKind.SELECTION_SET,
    selections: many(
      lexer,
      TokenKind.BRACE_L,
      parseSelection,
      TokenKind.BRACE_R
    ),
    loc: loc(lexer, start)
  };
}

function parseSelection(lexer) {
  return peek(lexer, TokenKind.SPREAD) ? parseFragment(lexer) : parseField(lexer);
}

function parseField(lexer) {
  const start = lexer.token;

  const nameOrAlias = parseName(lexer);
  let alias;
  let name;
  if (skip(lexer, TokenKind.COLON)) {
    alias = nameOrAlias;
    name = parseName(lexer);
  } else {
    name = nameOrAlias;
  }

  return {
    kind: NodeKind.FIELD,
    alias,
    name,
    arguments: parseArguments(lexer, false),
    directives: parseDirectives(lexer, false),
    selectionSet: peek(lexer, TokenKind.BRACE_L) ? parseSelectionSet(lexer) : undefined,
    loc: loc(lexer, start)
  };
}

function parseArguments(lexer, isConst) {
  const item = isConst ? parseConstArgument : parseArgument;
  return peek(lexer, TokenKind.PAREN_L) ? 
    many(lexer, TokenKind.PAREN_L, item, TokenKind.PAREN_R) : 
    [];
}

function parseArgument(lexer) {
  const start = lexer.token;
  return {
    kind: NodeKind.ARGUMENT,
    name: parseName(lexer),
    value: (expect(lexer, TokenKind.COLON), parseValueLiteral(lexer, false)),
    loc: loc(lexer, start)
  };
}

function parseConstArgument(lexer) {
  const start = lexer.token;
  return {
    kind: NodeKind.ARGUMENT,
    name: parseName(lexer),
    value: (expect(lexer, TokenKind.COLON), parseConstValue(lexer)),
    loc: loc(lexer, start)
  };
}

function parseFragment(lexer) {
  const start = lexer.token;
  expect(lexer, TokenKind.SPREAD);

  const hasTypeCondition = skipKeyword(lexer, 'on');
  if (!hasTypeCondition && peek(lexer, TokenKind.NAME)) {
    return {
      kind: NodeKind.FRAGMENT_SPREAD,
      name: parseFragmentName(lexer),
      directives: parseDirectives(lexer, false),
      loc: loc(lexer, start)
    };
  }
  return {
    kind: NodeKind.INLINE_FRAGMENT,
    typeCondition: hasTypeCondition ? parseNamedType(lexer) : undefined,
    directives: parseDirectives(lexer, false),
    selectionSet: parseSelectionSet(lexer),
    loc: loc(lexer, start)
  };
}

function parseFragmentDefinition(lexer) {
  const start = lexer.token;
  expectKeyword(lexer, 'fragment');
  // Experimental support for defining variables within fragments changes
  // the grammar of FragmentDefinition:
  //   - fragment FragmentName VariableDefinitions? on TypeCondition Directives? SelectionSet
  if (lexer.options.experimentalFragmentVariables) {
    return {
      kind: NodeKind.FRAGMENT_DEFINITION,
      name: parseFragmentName(lexer),
      variableDefinitions: parseVariableDefinitions(lexer),
      typeCondition: (expectKeyword(lexer, 'on'), parseNamedType(lexer)),
      directives: parseDirectives(lexer, false),
      selectionSet: parseSelectionSet(lexer),
      loc: loc(lexer, start)
    };
  }
  return {
    kind: NodeKind.FRAGMENT_DEFINITION,
    name: parseFragmentName(lexer),
    typeCondition: (expectKeyword(lexer, 'on'), parseNamedType(lexer)),
    directives: parseDirectives(lexer, false),
    selectionSet: parseSelectionSet(lexer),
    loc: loc(lexer, start)
  };
}

function parseFragmentName(lexer) {
  if (lexer.token.value === 'on') {
    throw unexpected(lexer);
  }
  return parseName(lexer);
}

function parseValueLiteral(lexer, isConst) {
  const token = lexer.token;
  switch (token.kind) {
    case TokenKind.BRACKET_L:
      return parseList(lexer, isConst);
    case TokenKind.BRACE_L:
      return parseObject(lexer, isConst);
    case TokenKind.INT:
      lexer.advance();
      return {
        kind: NodeKind.INT,
        value: token.value.toString(),
        loc: loc(lexer, token)
      };
    case TokenKind.FLOAT:
      lexer.advance();
      return {
        kind: NodeKind.FLOAT,
        value: token.value.toString(),
        loc: loc(lexer, token)
      };
    case TokenKind.STRING:
    case TokenKind.BLOCK_STRING:
      return parseStringLiteral(lexer);
    case TokenKind.NAME:
      if (token.value === 'true' || token.value === 'false') {
        lexer.advance();
        return {
          kind: NodeKind.BOOLEAN,
          value: token.value === 'true',
          loc: loc(lexer, token)
        };
      } else if (token.value === 'null') {
        lexer.advance();
        return {
          kind: NodeKind.NULL,
          loc: loc(lexer, token)
        };
      }
      lexer.advance();
      return {
        kind: NodeKind.ENUM,
        value: token.value.toString(),
        loc: loc(lexer, token)
      };
    case TokenKind.DOLLAR:
      if (!isConst) {
        return parseVariable(lexer);
      }
      break;
  }
  throw unexpected(lexer);
}

function parseStringLiteral(lexer) {
  const token = lexer.token;
  lexer.advance();
  return {
    kind: NodeKind.STRING,
    value: token.value.toString(),
    block: token.kind === TokenKind.BLOCK_STRING,
    loc: loc(lexer, token)
  };
}

function parseConstValue(lexer) {
  return parseValueLiteral(lexer, true);
}

function parseValueValue(lexer) {
  return parseValueLiteral(lexer, false);
}

function parseList(lexer, isConst) {
  const start = lexer.token;
  const item = isConst ? parseConstValue : parseValueValue;
  return {
    kind: NodeKind.LIST,
    values: any(lexer, TokenKind.BRACKET_L, item, TokenKind.BRACKET_R),
    loc: loc(lexer, start)
  };
}

function parseObject(lexer, isConst) {
  const start = lexer.token;
  expect(lexer, TokenKind.BRACE_L);
  const fields = [];
  while (!skip(lexer, TokenKind.BRACE_R)) {
    fields.push(parseObjectField(lexer, isConst));
  }
  return {
    kind: NodeKind.OBJECT,
    fields,
    loc: loc(lexer, start)
  };
}

function parseObjectField(lexer, isConst) {
  const start = lexer.token;
  return {
    kind: NodeKind.OBJECT_FIELD,
    name: parseName(lexer),
    value: (expect(lexer, TokenKind.COLON), parseValueLiteral(lexer, isConst)),
    loc: loc(lexer, start)
  };
}

function parseDirectives(lexer, isConst) {
  const directives = [];
  while (peek(lexer, TokenKind.AT)) {
    directives.push(parseDirective(lexer, isConst));
  }
  return directives;
}

function parseDirective(lexer, isConst) {
  const start = lexer.token;
  expect(lexer, TokenKind.AT);
  return {
    kind: NodeKind.DIRECTIVE,
    name: parseName(lexer),
    arguments: parseArguments(lexer, isConst),
    loc: loc(lexer, start)
  };
}

function parseTypeReference(lexer) {
  const start = lexer.token;
  let type;
  if (skip(lexer, TokenKind.BRACKET_L)) {
    type = parseTypeReference(lexer);
    expect(lexer, TokenKind.BRACKET_R);
    type = {
      kind: NodeKind.LIST_TYPE,
      type,
      loc: loc(lexer, start)
    };
  } else {
    type = parseNamedType(lexer);
  }
  if (skip(lexer, TokenKind.BANG)) {
    return {
      kind: NodeKind.NON_NULL_TYPE,
      type,
      loc: loc(lexer, start)
    };
  }
  return type;
}

function parseNamedType(lexer) {
  const start = lexer.token;
  return {
    kind: NodeKind.NAMED_TYPE,
    name: parseName(lexer),
    loc: loc(lexer, start)
  };
}

function parseTypeSystemDefinition(lexer) {
  // Many definitions begin with a description and require a lookahead.
  const keywordToken = peekDescription(lexer) ? lexer.lookahead() : lexer.token;

  if (keywordToken.kind === TokenKind.NAME) {
    switch (keywordToken.value) {
      case 'schema':
        return parseSchemaDefinition(lexer);
      case 'scalar':
        return parseScalarTypeDefinition(lexer);
      case 'type':
        return parseObjectTypeDefinition(lexer);
      case 'interface':
        return parseInterfaceTypeDefinition(lexer);
      case 'union':
        return parseUnionTypeDefinition(lexer);
      case 'enum':
        return parseEnumTypeDefinition(lexer);
      case 'input':
        return parseInputObjectTypeDefinition(lexer);
      case 'directive':
        return parseDirectiveDefinition(lexer);
    }
  }

  throw unexpected(lexer, keywordToken);
}

function peekDescription(lexer) {
  return peek(lexer, TokenKind.STRING) || peek(lexer, TokenKind.BLOCK_STRING);
}

function parseDescription(lexer) {
  if (peekDescription(lexer)) {
    return parseStringLiteral(lexer);
  }
}

function parseSchemaDefinition(lexer) {
  const start = lexer.token;
  expectKeyword(lexer, 'schema');
  const directives = parseDirectives(lexer, true);
  const operationTypes = many(
    lexer,
    TokenKind.BRACE_L,
    parseOperationTypeDefinition,
    TokenKind.BRACE_R
  );
  return {
    kind: NodeKind.SCHEMA_DEFINITION,
    directives,
    operationTypes,
    loc: loc(lexer, start)
  };
}

function parseOperationTypeDefinition(lexer) {
  const start = lexer.token;
  const operation = parseOperationType(lexer);
  expect(lexer, TokenKind.COLON);
  const type = parseNamedType(lexer);
  return {
    kind: NodeKind.OPERATION_TYPE_DEFINITION,
    operation,
    type,
    loc: loc(lexer, start)
  };
}

function parseScalarTypeDefinition(lexer) {
  const start = lexer.token;
  const description = parseDescription(lexer);
  expectKeyword(lexer, 'scalar');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  return {
    kind: NodeKind.SCALAR_TYPE_DEFINITION,
    description,
    name,
    directives,
    loc: loc(lexer, start)
  };
}

function parseObjectTypeDefinition(lexer) {
  const start = lexer.token;
  const description = parseDescription(lexer);
  expectKeyword(lexer, 'type');
  const name = parseName(lexer);
  const interfaces = parseImplementsInterfaces(lexer);
  const directives = parseDirectives(lexer, true);
  const fields = parseFieldsDefinition(lexer);
  return {
    kind: NodeKind.OBJECT_TYPE_DEFINITION,
    description,
    name,
    interfaces,
    directives,
    fields,
    loc: loc(lexer, start)
  };
}

function parseImplementsInterfaces(lexer) {
  const types = [];
  if (skipKeyword(lexer, 'implements')) {
    // Optional leading ampersand
    skip(lexer, TokenKind.AMP);
    do {
      types.push(parseNamedType(lexer));
    } while (
      skip(lexer, TokenKind.AMP) ||
      // Legacy support for the SDL?
      (lexer.options.allowLegacySDLImplementsInterfaces &&
        peek(lexer, TokenKind.NAME))
    );
  }
  return types;
}

function parseFieldsDefinition(lexer) {
  // Legacy support for the SDL?
  if (
    lexer.options.allowLegacySDLEmptyFields &&
    peek(lexer, TokenKind.BRACE_L) &&
    lexer.lookahead().kind === TokenKind.BRACE_R
  ) {
    lexer.advance();
    lexer.advance();
    return [];
  }
  return peek(lexer, TokenKind.BRACE_L) ? many(lexer, TokenKind.BRACE_L, parseFieldDefinition, TokenKind.BRACE_R) : [];
}

function parseFieldDefinition(lexer) {
  const start = lexer.token;
  const description = parseDescription(lexer);
  const name = parseName(lexer);
  const args = parseArgumentDefs(lexer);
  expect(lexer, TokenKind.COLON);
  const type = parseTypeReference(lexer);
  const directives = parseDirectives(lexer, true);
  return {
    kind: NodeKind.FIELD_DEFINITION,
    description,
    name,
    arguments: args,
    type,
    directives,
    loc: loc(lexer, start)
  };
}

function parseArgumentDefs(lexer) {
  if (!peek(lexer, TokenKind.PAREN_L)) {
    return [];
  }
  return many(lexer, TokenKind.PAREN_L, parseInputValueDef, TokenKind.PAREN_R);
}

function parseInputValueDef(lexer) {
  const start = lexer.token;
  const description = parseDescription(lexer);
  const name = parseName(lexer);
  expect(lexer, TokenKind.COLON);
  const type = parseTypeReference(lexer);
  let defaultValue;
  if (skip(lexer, TokenKind.EQUALS)) {
    defaultValue = parseConstValue(lexer);
  }
  const directives = parseDirectives(lexer, true);
  return {
    kind: NodeKind.INPUT_VALUE_DEFINITION,
    description,
    name,
    type,
    defaultValue,
    directives,
    loc: loc(lexer, start)
  };
}

function parseInterfaceTypeDefinition(lexer) {
  const start = lexer.token;
  const description = parseDescription(lexer);
  expectKeyword(lexer, 'interface');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  const fields = parseFieldsDefinition(lexer);
  return {
    kind: NodeKind.INTERFACE_TYPE_DEFINITION,
    description,
    name,
    directives,
    fields,
    loc: loc(lexer, start)
  };
}

function parseUnionTypeDefinition(lexer) {
  const start = lexer.token;
  const description = parseDescription(lexer);
  expectKeyword(lexer, 'union');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  const types = parseUnionMemberTypes(lexer);
  return {
    kind: NodeKind.UNION_TYPE_DEFINITION,
    description,
    name,
    directives,
    types,
    loc: loc(lexer, start)
  };
}

function parseUnionMemberTypes(lexer) {
  const types = [];
  if (skip(lexer, TokenKind.EQUALS)) {
    // Optional leading pipe
    skip(lexer, TokenKind.PIPE);
    do {
      types.push(parseNamedType(lexer));
    } while (skip(lexer, TokenKind.PIPE));
  }
  return types;
}

function parseEnumTypeDefinition(lexer) {
  const start = lexer.token;
  const description = parseDescription(lexer);
  expectKeyword(lexer, 'enum');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  const values = parseEnumValuesDefinition(lexer);
  return {
    kind: NodeKind.ENUM_TYPE_DEFINITION,
    description,
    name,
    directives,
    values,
    loc: loc(lexer, start)
  };
}

function parseEnumValuesDefinition(lexer) {
  return peek(lexer, TokenKind.BRACE_L) ?
    many(lexer, TokenKind.BRACE_L, parseEnumValueDefinition, TokenKind.BRACE_R) : [];
}

function parseEnumValueDefinition(lexer) {
  const start = lexer.token;
  const description = parseDescription(lexer);
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  return {
    kind: NodeKind.ENUM_VALUE_DEFINITION,
    description,
    name,
    directives,
    loc: loc(lexer, start)
  };
}

function parseInputObjectTypeDefinition(lexer) {
  const start = lexer.token;
  const description = parseDescription(lexer);
  expectKeyword(lexer, 'input');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  const fields = parseInputFieldsDefinition(lexer);
  return {
    kind: NodeKind.INPUT_OBJECT_TYPE_DEFINITION,
    description,
    name,
    directives,
    fields,
    loc: loc(lexer, start)
  };
}

function parseInputFieldsDefinition(lexer) {
  return peek(lexer, TokenKind.BRACE_L) ? many(lexer, TokenKind.BRACE_L, parseInputValueDef, TokenKind.BRACE_R) : [];
}

function parseTypeSystemExtension(lexer) {
  const keywordToken = lexer.lookahead();

  if (keywordToken.kind === TokenKind.NAME) {
    switch (keywordToken.value) {
      case 'schema':
        return parseSchemaExtension(lexer);
      case 'scalar':
        return parseScalarTypeExtension(lexer);
      case 'type':
        return parseObjectTypeExtension(lexer);
      case 'interface':
        return parseInterfaceTypeExtension(lexer);
      case 'union':
        return parseUnionTypeExtension(lexer);
      case 'enum':
        return parseEnumTypeExtension(lexer);
      case 'input':
        return parseInputObjectTypeExtension(lexer);
    }
  }

  throw unexpected(lexer, keywordToken);
}

function parseSchemaExtension(lexer) {
  const start = lexer.token;
  expectKeyword(lexer, 'extend');
  expectKeyword(lexer, 'schema');
  const directives = parseDirectives(lexer, true);
  const operationTypes = peek(lexer, TokenKind.BRACE_L) ? 
    many(lexer, TokenKind.BRACE_L, parseOperationTypeDefinition, TokenKind.BRACE_R) : [];
  if (directives.length === 0 && operationTypes.length === 0) {
    throw unexpected(lexer);
  }
  return {
    kind: NodeKind.SCHEMA_EXTENSION,
    directives,
    operationTypes,
    loc: loc(lexer, start)
  };
}

function parseScalarTypeExtension(lexer) {
  const start = lexer.token;
  expectKeyword(lexer, 'extend');
  expectKeyword(lexer, 'scalar');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  if (directives.length === 0) {
    throw unexpected(lexer);
  }
  return {
    kind: NodeKind.SCALAR_TYPE_EXTENSION,
    name,
    directives,
    loc: loc(lexer, start)
  };
}

function parseObjectTypeExtension(lexer) {
  const start = lexer.token;
  expectKeyword(lexer, 'extend');
  expectKeyword(lexer, 'type');
  const name = parseName(lexer);
  const interfaces = parseImplementsInterfaces(lexer);
  const directives = parseDirectives(lexer, true);
  const fields = parseFieldsDefinition(lexer);
  if (
    interfaces.length === 0 &&
    directives.length === 0 &&
    fields.length === 0
  ) {
    throw unexpected(lexer);
  }
  return {
    kind: NodeKind.OBJECT_TYPE_EXTENSION,
    name,
    interfaces,
    directives,
    fields,
    loc: loc(lexer, start)
  };
}

function parseInterfaceTypeExtension(lexer) {
  const start = lexer.token;
  expectKeyword(lexer, 'extend');
  expectKeyword(lexer, 'interface');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  const fields = parseFieldsDefinition(lexer);
  if (directives.length === 0 && fields.length === 0) {
    throw unexpected(lexer);
  }
  return {
    kind: NodeKind.INTERFACE_TYPE_EXTENSION,
    name,
    directives,
    fields,
    loc: loc(lexer, start)
  };
}

function parseUnionTypeExtension(lexer) {
  const start = lexer.token;
  expectKeyword(lexer, 'extend');
  expectKeyword(lexer, 'union');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  const types = parseUnionMemberTypes(lexer);
  if (directives.length === 0 && types.length === 0) {
    throw unexpected(lexer);
  }
  return {
    kind: NodeKind.UNION_TYPE_EXTENSION,
    name,
    directives,
    types,
    loc: loc(lexer, start)
  };
}

function parseEnumTypeExtension(lexer) {
  const start = lexer.token;
  expectKeyword(lexer, 'extend');
  expectKeyword(lexer, 'enum');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  const values = parseEnumValuesDefinition(lexer);
  if (directives.length === 0 && values.length === 0) {
    throw unexpected(lexer);
  }
  return {
    kind: NodeKind.ENUM_TYPE_EXTENSION,
    name,
    directives,
    values,
    loc: loc(lexer, start)
  };
}

function parseInputObjectTypeExtension(lexer) {
  const start = lexer.token;
  expectKeyword(lexer, 'extend');
  expectKeyword(lexer, 'input');
  const name = parseName(lexer);
  const directives = parseDirectives(lexer, true);
  const fields = parseInputFieldsDefinition(lexer);
  if (directives.length === 0 && fields.length === 0) {
    throw unexpected(lexer);
  }
  return {
    kind: NodeKind.INPUT_OBJECT_TYPE_EXTENSION,
    name,
    directives,
    fields,
    loc: loc(lexer, start)
  };
}

function parseDirectiveDefinition(lexer) {
  const start = lexer.token;
  const description = parseDescription(lexer);
  expectKeyword(lexer, 'directive');
  expect(lexer, TokenKind.AT);
  const name = parseName(lexer);
  const args = parseArgumentDefs(lexer);
  expectKeyword(lexer, 'on');
  const locations = parseDirectiveLocations(lexer);
  return {
    kind: NodeKind.DIRECTIVE_DEFINITION,
    description,
    name,
    arguments: args,
    locations,
    loc: loc(lexer, start)
  };
}

function parseDirectiveLocations(lexer) {
  // Optional leading pipe
  skip(lexer, TokenKind.PIPE);
  const locations = [];
  do {
    locations.push(parseDirectiveLocation(lexer));
  } while (skip(lexer, TokenKind.PIPE));
  return locations;
}

function parseDirectiveLocation(lexer) {
  const start = lexer.token;
  const name = parseName(lexer);
  if (DirectiveLocation.hasOwnProperty(name.value)) {
    return name;
  }
  throw unexpected(lexer, start);
}

// Core parsing utility functions

class Loc {
  constructor(startToken, endToken, source) {
    this.start = startToken.start;
    this.end = endToken.end;
    this.startToken = startToken;
    this.endToken = endToken;
    this.source = source;
  }

  defineToJSON() {
    return { start: this.start, end: this.end };
  }
}

/**
 * Returns a location object, used to identify the place in
 * the source that created a given parsed object.
 */
function loc(lexer, startToken) {
  if (!lexer.options.noLocation) {
    return new Loc(startToken, lexer.lastToken, lexer.source);
  }
}

/**
 * Determines if the next token is of a given kind
 */
function peek(lexer, kind) {
  return lexer.token.kind === kind;
}

/**
 * If the next token is of the given kind, return true after advancing
 * the lexer. Otherwise, do not change the parser state and return false.
 */
function skip(lexer, kind) {
  if (lexer.token.kind === kind) {
    lexer.advance();
    return true;
  }
  return false;
}

/**
 * If the next token is of the given kind, return that token after advancing
 * the lexer. Otherwise, do not change the parser state and throw an error.
 */
function expect(lexer, kind) {
  const token = lexer.token;
  if (token.kind === kind) {
    lexer.advance();
    return token;
  }
  throw syntaxError(
    lexer.source,
    token.start,
    `Expected ${kind}, found ${token.getTokenDesc()}`
  );
}

/**
 * If the next token is a keyword with the given value, return true after advancing
 * the lexer. Otherwise, do not change the parser state and return false.
 */
function skipKeyword(lexer, value) {
  const token = lexer.token;
  if (token.kind === TokenKind.NAME && token.value === value) {
    lexer.advance();
    return true;
  }
  return false;
}

/**
 * If the next token is a keyword with the given value, return that token after
 * advancing the lexer. Otherwise, do not change the parser state and throw
 * an error.
 */
function expectKeyword(lexer, value) {
  if (!skipKeyword(lexer, value)) {
    throw syntaxError(
      lexer.source,
      lexer.token.start,
      `Expected "${value}", found ${lexer.token.getTokenDesc()}`
    );
  }
}

/**
 * Helper function for creating an error when an unexpected lexed token
 * is encountered.
 */
function unexpected(lexer, atToken) {
  const token = atToken || lexer.token;
  return syntaxError(
    lexer.source,
    token.start,
    `Unexpected ${token.getTokenDesc()}`
  );
}

/**
 * Returns a possibly empty list of parse nodes, determined by
 * the parseFn. This list begins with a lex token of openKind
 * and ends with a lex token of closeKind. Advances the parser
 * to the next lex token after the closing token.
 */
function any(lexer, openKind, parseFn, closeKind) {
  expect(lexer, openKind);
  const nodes = [];
  while (!skip(lexer, closeKind)) {
    nodes.push(parseFn(lexer));
  }
  return nodes;
}

/**
 * Returns a non-empty list of parse nodes, determined by
 * the parseFn. This list begins with a lex token of openKind
 * and ends with a lex token of closeKind. Advances the parser
 * to the next lex token after the closing token.
 */
function many(lexer, openKind, parseFn, closeKind) {
  expect(lexer, openKind);
  const nodes = [parseFn(lexer)];
  while (!skip(lexer, closeKind)) {
    nodes.push(parseFn(lexer));
  }
  return nodes;
}

module.exports = {
  parse: parse,
  parseValue: parseValue,
  parseType: parseType,
  parseConstValue: parseConstValue,
  parseTypeReference: parseTypeReference,
  parseNamedType: parseNamedType
};