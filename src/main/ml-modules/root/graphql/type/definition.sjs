'use strict';

const check = require('../check.sjs');
const inspect = require('../util/inspect.sjs').inspect;
const instanceOf = require('../util/instanceOf.sjs').instanceOf;
const objectValues = require('../util/objectValues.sjs').objectValues; 
const Kind = require('../language.ast.sjs').NodeKind;
const GraphQLSchema = require('schema.sjs').GraphQLSchema;

function isType(type) {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    isListType(type) ||
    isNonNullType(type)
  );
}

function assertType(type) {
  check.isTrue(isType(type), `Expected ${inspect(type)} to be a GraphQL type.`);
  return type;
}

function isScalarType(type) {
  return instanceOf(type, GraphQLScalarType);
}

function assertScalarType(type) {
  check.isTrue(
    isScalarType(type),
    `Expected ${inspect(type)} to be a GraphQL Scalar type.`
  );
  return type;
}

function isObjectType(type) {
  return instanceOf(type, GraphQLObjectType);
}

function assertObjectType(type) {
  check.isTrue(
    isObjectType(type),
    `Expected ${inspect(type)} to be a GraphQL Object type.`
  );
  return type;
}

function isInterfaceType(type) {
  return instanceOf(type, GraphQLInterfaceType);
}

function assertInterfaceType(type) {
  check.isTrue(
    isInterfaceType(type),
    `Expected ${inspect(type)} to be a GraphQL Interface type.`
  );
  return type;
}

function isUnionType(type) {
  return instanceOf(type, GraphQLUnionType);
}

function assertUnionType(type) {
  check.isTrue(
    isUnionType(type),
    `Expected ${inspect(type)} to be a GraphQL Union type.`
  );
  return type;
}

function isEnumType(type) {
  return instanceOf(type, GraphQLEnumType);
}

function assertEnumType(type) {
  check.isTrue(
    isEnumType(type),
    `Expected ${inspect(type)} to be a GraphQL Enum type.`
  );
  return type;
}

function isInputObjectType(type) {
  return instanceOf(type, GraphQLInputObjectType);
}

function assertInputObjectType(type) {
  check.isTrue(
    isInputObjectType(type),
    `Expected ${inspect(type)} to be a GraphQL Input Object type.`
  );
  return type;
}

function isListType(type) {
  return instanceOf(type, GraphQLList);
}

function assertListType(type) {
  check.isTrue(
    isListType(type),
    `Expected ${inspect(type)} to be a GraphQL List type.`
  );
  return type;
}

function isNonNullType(type) {
  return instanceOf(type, GraphQLNonNull);
}

function assertNonNullType(type) {
  check.isTrue(
    isNonNullType(type),
    `Expected ${inspect(type)} to be a GraphQL Non-Null type.`
  );
  return type;
}

function isInputType(type) {
  return (
    isScalarType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    (isWrappingType(type) && isInputType(type.ofType))
  );
}

function assertInputType(type) {
  check.isTrue(
    isInputType(type),
    `Expected ${inspect(type)} to be a GraphQL input type.`
  );
  return type;
}

function assertOutputType(type) {
  check.isTrue(
    isOutputType(type),
    `Expected ${inspect(type)} to be a GraphQL output type.`
  );
  return type;
}

function isLeafType(type) {
  return isScalarType(type) || isEnumType(type);
}

function assertLeafType(type) {
  check.isTrue(
    isLeafType(type),
    `Expected ${inspect(type)} to be a GraphQL leaf type.`
  );
  return type;
}

function isCompositeType(type) {
  return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}

function assertCompositeType(type) {
  check.isTrue(
    isCompositeType(type),
    `Expected ${inspect(type)} to be a GraphQL composite type.`
  );
  return type;
}

function isAbstractType(type) {
  return isInterfaceType(type) || isUnionType(type);
}

function assertAbstractType(type) {
  check.isTrue(
    isAbstractType(type),
    `Expected ${inspect(type)} to be a GraphQL abstract type.`
  );
  return type;
}

class GraphQLList {
  constructor(ofType) {
    if (this instanceof GraphQLList) {
      this.ofType = assertType(ofType);
    } else {
      return new GraphQLList(ofType);
    }
  }

  toString() {
    return '[' + String(this.ofType) + ']';
  }
}

class GraphQLNonNull {
  constructor(ofType) {
    if (this instanceof GraphQLNonNull) {
      this.ofType = assertNullableType(ofType);
    } else {
      return new GraphQLNonNull(ofType);
    }
  }

  toString() {
    return String(this.ofType) + '!';
  }
}

function isWrappingType(type) {
  return isListType(type) || isNonNullType(type);
}

function assertWrappingType(type) {
  check.isTrue(
    isWrappingType(type),
    `Expected ${inspect(type)} to be a GraphQL wrapping type.`
  );
  return type;
}

function isNullableType(type) {
  return isType(type) && !isNonNullType(type);
}

function assertNullableType(type) {
  check.isTrue(
    isNullableType(type),
    `Expected ${inspect(type)} to be a GraphQL nullable type.`
  );
  return type;
}

function getNullableType(type) {
  if (type) {
    return isNonNullType(type) ? type.ofType : type;
  }
}

function isNamedType(type) {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    isInputObjectType(type)
  );
}

function assertNamedType(type) {
  check.isTrue(
    isNamedType(type),
    `Expected ${inspect(type)} to be a GraphQL named type.`
  );
  return type;
}

function getNamedType(type) {
  if (type) {
    let unwrappedType = type;
    while (isWrappingType(unwrappedType)) {
      unwrappedType = unwrappedType.ofType;
    }
    return unwrappedType;
  }
}

function resolveThunk(thunk){
  return typeof thunk === 'function' ? thunk() : thunk;
}

class GraphQLScalarType {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.serialize = config.serialize;
    this.parseValue = config.parseValue || (value => value);
    this.parseLiteral = config.parseLiteral || valueFromASTUntyped;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    check.isTrue(typeof config.name === 'string', 'Must provide name.');
    check.isTrue(
      typeof config.serialize === 'function',
      `${this.name} must provide "serialize" function. If this custom Scalar ` +
        'is also used as an input type, ensure "parseValue" and "parseLiteral" ' +
        'functions are also provided.'
    );
    if (config.parseValue || config.parseLiteral) {
      check.isTrue(
        typeof config.parseValue === 'function' && typeof config.parseLiteral === 'function',
        `${this.name} must provide both "parseValue" and "parseLiteral" functions.`
      );
    }
  }

  toString() {
    return this.name;
  }
}

class GraphQLObjectType {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this.isTypeOf = config.isTypeOf;
    this._fields = defineFieldMap.bind(undefined, config);
    this._interfaces = defineInterfaces.bind(undefined, config);
    check.isTrue(typeof config.name === 'string', 'Must provide name.');
    check.isTrue(
      config.isTypeOf == null || typeof config.isTypeOf === 'function',
      `${this.name} must provide "isTypeOf" as a function, ` +
        `but got: ${inspect(config.isTypeOf)}.`
    );
  }

  getFields() {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  getInterfaces() {
    if (typeof this._interfaces === 'function') {
      this._interfaces = this._interfaces();
    }
    return this._interfaces;
  }

  toString() {
    return this.name;
  }
}

function defineInterfaces(config) {
  const interfaces = resolveThunk(config.interfaces) || [];
  check.isTrue(
    Array.isArray(interfaces),
    `${config.name} interfaces must be an Array or a function which returns ` +
      'an Array.'
  );
  return interfaces;
}

function defineFieldMap(config) {
  const fieldMap = resolveThunk(config.fields) || {};
  check.isTrue(
    isPlainObj(fieldMap),
    `${config.name} fields must be an object with field names as keys or a ` +
      'function which returns such an object.'
  );

  const resultFieldMap = Object.create(null);
  for (const fieldName of Object.keys(fieldMap)) {
    const fieldConfig = fieldMap[fieldName];
    check.isTrue(
      isPlainObj(fieldConfig),
      `${config.name}.${fieldName} field config must be an object`
  );
    check.isTrue(
      !fieldConfig.hasOwnProperty('isDeprecated'),
      `${config.name}.${fieldName} should provide "deprecationReason" ` +
        'instead of "isDeprecated".'
    );
    let field = Object.assign(
      fieldConfig, {
        isDeprecated: Boolean(fieldConfig.deprecationReason),
        name: fieldName
      });
    check.isTrue(
      field.resolve == null || typeof field.resolve === 'function',
      `${config.name}.${fieldName} field resolver must be a function if ` +
        `provided, but got: ${inspect(field.resolve)}.`
  );
    const argsConfig = fieldConfig.args;
    if (!argsConfig) {
      field.args = [];
    } else {
      check.isTrue(
        isPlainObj(argsConfig),
        `${config.name}.${fieldName} args must be an object with argument ` +
          'names as keys.'
      );
      field.args = Object.keys(argsConfig).map(argName => {
        const arg = argsConfig[argName];
        return {
          name: argName,
          description: arg.description === undefined ? null : arg.description,
          type: arg.type,
          defaultValue: arg.defaultValue,
          astNode: arg.astNode,
        };
      });
    }
    resultFieldMap[fieldName] = field;
  }
  return resultFieldMap;
}

function isPlainObj(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj);
}

class GraphQLInterfaceType {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this.resolveType = config.resolveType;
    this._fields = defineFieldMap.bind(undefined, config);
    check.isTrue(typeof config.name === 'string', 'Must provide name.');
    check.isTrue(
      config.resolveType == null || typeof config.resolveType === 'function',
      `${this.name} must provide "resolveType" as a function, ` +
        `but got: ${inspect(config.resolveType)}.`
    );
  }

  getFields() {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  toString() {
    return this.name;
  }
}

class GraphQLUnionType {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this.resolveType = config.resolveType;
    this._types = defineTypes.bind(undefined, config);
    check.isTrue(typeof config.name === 'string', 'Must provide name.');
    check.isTrue(
      config.resolveType == null || typeof config.resolveType === 'function',
      `${this.name} must provide "resolveType" as a function, ` +
        `but got: ${inspect(config.resolveType)}.`
    );
  }

  getTypes() {
    if (typeof this._types === 'function') {
      this._types = this._types();
    }
    return this._types;
  }

  toString() {
    return this.name;
  }
}

function defineTypes(config) {
  const types = resolveThunk(config.types) || [];
  check.isTrue(
    Array.isArray(types),
    'Must provide Array of types or a function which returns ' +
      `such an array for Union ${config.name}.`
  );
  return types;
}

class GraphQLEnumType {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this._values = defineEnumValues(this, config.values);
    this._valueLookup = new Map(
      this._values.map(enumValue => [enumValue.value, enumValue])
    );
    this._nameLookup = keyMap(this._values, value => value.name);

    check.isTrue(typeof config.name === 'string', 'Must provide name.');
  }

  getValues() {
    return this._values;
  }

  getValue(name) {
    return this._nameLookup[name];
  }

  serialize(value) {
    const enumValue = this._valueLookup.get(value);
    if (enumValue) {
      return enumValue.name;
    }
  }

  parseValue(value) {
    if (typeof value === 'string') {
      const enumValue = this.getValue(value);
      if (enumValue) {
        return enumValue.value;
      }
    }
  }

  parseLiteral(valueNode, _variables) {
    // Note: variables will be resolved to a value before calling this function.
    if (valueNode.kind === Kind.ENUM) {
      const enumValue = this.getValue(valueNode.value);
      if (enumValue) {
        return enumValue.value;
      }
    }
  }

  toString() {
    return this.name;
  }
}

function defineEnumValues(type, valueMap) {
  check.isTrue(
    isPlainObj(valueMap),
    `${type.name} values must be an object with value names as keys.`
  );
  return Object.keys(valueMap).map(valueName => {
    const value = valueMap[valueName];
    check.isTrue(
      isPlainObj(value),
      `${type.name}.${valueName} must refer to an object with a "value" key ` +
        `representing an internal value but got: ${inspect(value)}.`
  );
    check.isTrue(
      !value.hasOwnProperty('isDeprecated'),
      `${type.name}.${valueName} should provide "deprecationReason" instead ` +
        'of "isDeprecated".'
    );
    return {
      name: valueName,
      description: value.description,
      isDeprecated: Boolean(value.deprecationReason),
      deprecationReason: value.deprecationReason,
      astNode: value.astNode,
      value: value.hasOwnProperty('value') ? value.value : valueName,
    };
  });
}

class GraphQLInputObjectType {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this._fields = defineInputFieldMap.bind(undefined, config);
    check.isTrue(typeof config.name === 'string', 'Must provide name.');
  }

  getFields() {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  toString() {
    return this.name;
  }
}

function defineInputFieldMap(config) {
  const fieldMap = resolveThunk(config.fields) || {};
  check.isTrue(
    isPlainObj(fieldMap),
    `${config.name} fields must be an object with field names as keys or a ` +
      'function which returns such an object.'
  );
  const resultFieldMap = Object.create(null);
  for (const fieldName of Object.keys(fieldMap)) {
    const field = Object.assign(
      fieldMap[fieldName], {
      name: fieldName
    });
    check.isTrue(
      !field.hasOwnProperty('resolve'),
      `${config.name}.${fieldName} field has a resolve property, but ` +
        'Input Types cannot define resolvers.'
    );
    resultFieldMap[fieldName] = field;
  }
  return resultFieldMap;
}

function isRequiredInputField(field) {
  return isNonNullType(field.type) && field.defaultValue === undefined;
}