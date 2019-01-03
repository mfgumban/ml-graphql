'use strict';

const definition = require('definition.sjs');
const check = require('../check.sjs');
const inspect = require('../util/inspect.sjs').inspect;
const find = require('../util/find.sjs').find;
const instanceOf = require('../util/instanceOf.sjs').instanceOf;
const objectValues = require('../util/objectValues.sjs').objectValues;

function isSchema(schema) {
  return instanceOf(schema, GraphQLSchema);
}

function assertSchema(schema) {
  check.isTrue(isSchema(schema), `Expected ${inspect(schema)} to be a GraphQL schema.`);
  return schema;
}

class GraphQLSchema {
  constructor(config) {
    // If this schema was built from a source known to be valid, then it may be
    // marked with assumeValid to avoid an additional type system validation.
    if (config && config.assumeValid) {
      this.__validationErrors = [];
    } else {
      this.__validationErrors = undefined;
      // Otherwise check for common mistakes during construction to produce
      // clear and early error messages.
      check.isTrue(
        typeof config === 'object',
        'Must provide configuration object.'
      );
      check.isTrue(
        !config.types || Array.isArray(config.types),
        `"types" must be Array if provided but got: ${inspect(config.types)}.`
      );
      check.isTrue(
        !config.directives || Array.isArray(config.directives),
        '"directives" must be Array if provided but got: ' +
          `${inspect(config.directives)}.`
      );
      check.isTrue(
        !config.allowedLegacyNames || Array.isArray(config.allowedLegacyNames),
        '"allowedLegacyNames" must be Array if provided but got: ' +
          `${inspect(config.allowedLegacyNames)}.`
      );
    }

    this.__allowedLegacyNames = config.allowedLegacyNames || [];
    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription;
    // Provide specified directives (e.g. @include and @skip) by default.
    this._directives = config.directives || specifiedDirectives;
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;

    // Build type map now to detect any errors within this schema.
    let initialTypes = [
      this.getQueryType(),
      this.getMutationType(),
      this.getSubscriptionType(),
      __Schema
    ];

    const types = config.types;
    if (types) {
      initialTypes = initialTypes.concat(types);
    }

    // Keep track of all types referenced within the schema.
    let typeMap = Object.create(null);

    // First by deeply visiting all initial types.
    typeMap = initialTypes.reduce(typeMapReducer, typeMap);

    // Then by deeply visiting all directive types.
    typeMap = this._directives.reduce(typeMapDirectiveReducer, typeMap);

    // Storing the resulting map for reference by the schema.
    this._typeMap = typeMap;

    this._possibleTypeMap = Object.create(null);

    // Keep track of all implementations by interface name.
    this._implementations = Object.create(null);
    for (const typeName of Object.keys(this._typeMap)) {
      const type = this._typeMap[typeName];
      if (isObjectType(type)) {
        for (const iface of type.getInterfaces()) {
          if (isInterfaceType(iface)) {
            const impls = this._implementations[iface.name];
            if (impls) {
              impls.push(type);
            } else {
              this._implementations[iface.name] = [type];
            }
          }
        }
      } else if (isAbstractType(type) && !this._implementations[type.name]) {
        this._implementations[type.name] = [];
      }
    }
  }

  getQueryType() {
    return this._queryType;
  }

  getMutationType() {
    return this._mutationType;
  }

  getSubscriptionType() {
    return this._subscriptionType;
  }

  getTypeMap() {
    return this._typeMap;
  }

  getType(name) {
    return this.getTypeMap()[name];
  }

  getPossibleTypes(abstractType) {
    if (isUnionType(abstractType)) {
      return abstractType.getTypes();
    }
    return this._implementations[abstractType.name];
  }

  isPossibleType(abstractType, possibleType) {
    const possibleTypeMap = this._possibleTypeMap;

    if (!possibleTypeMap[abstractType.name]) {
      const possibleTypes = this.getPossibleTypes(abstractType);
      possibleTypeMap[abstractType.name] = possibleTypes.reduce(
        (map, type) => ((map[type.name] = true), map),
        Object.create(null)
      );
    }

    return Boolean(possibleTypeMap[abstractType.name][possibleType.name]);
  }

  getDirectives() {
    return this._directives;
  }

  getDirective(name) {
    return find(this.getDirectives(), directive => directive.name === name);
  }
}

function typeMapReducer(map, type) {
  if (!type) {
    return map;
  }
  if (isWrappingType(type)) {
    return typeMapReducer(map, type.ofType);
  }
  if (map[type.name]) {
    check.isTrue(
      map[type.name] === type,
      `Schema must contain unique named types but contains multiple types named "${type.name}".`
    );
    return map;
  }
  map[type.name] = type;

  let reducedMap = map;

  if (isUnionType(type)) {
    reducedMap = type.getTypes().reduce(typeMapReducer, reducedMap);
  }

  if (isObjectType(type)) {
    reducedMap = type.getInterfaces().reduce(typeMapReducer, reducedMap);
  }

  if (isObjectType(type) || isInterfaceType(type)) {
    for (const field of objectValues(type.getFields())) {
      if (field.args) {
        const fieldArgTypes = field.args.map(arg => arg.type);
        reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
      }
      reducedMap = typeMapReducer(reducedMap, field.type);
    }
  }

  if (isInputObjectType(type)) {
    for (const field of objectValues(type.getFields())) {
      reducedMap = typeMapReducer(reducedMap, field.type);
    }
  }

  return reducedMap;
}

function typeMapDirectiveReducer(map, directive) {
  // Directives are not validated until validateSchema() is called.
  if (!isDirective(directive)) {
    return map;
  }
  return directive.args.reduce(
    (_map, arg) => typeMapReducer(_map, arg.type),
    map
  );
}