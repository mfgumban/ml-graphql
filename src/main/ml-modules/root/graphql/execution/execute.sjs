'use strict';

const GraphQLError = require('../error/error.sjs').GraphQLError;
const NodeKind = require('../language/ast.sjs').NodeKind;

class ExecutionContext {
  constructor(schema, document, root, context, variables, operationName) {
    this.schema = schema;
    this.root = root;
    this.context = context;
    this.errors = [];
    this.fragments = {};
    this.operation = null;
    
    let hasMultipleAssumedOperations = false;
    document.definitions.forEach((definition) => {
      switch(definition.kind) {
        case NodeKind.OPERATION_DEFINITION:
          if (!operationName) {
            hasMultipleAssumedOperations = true;
          } 
          else if (!operationName || (definition.name && definition.name.value === operationName)) {
            this.operation = definition;
          }
          break;
        case NodeKind.FRAGMENT_DEFINITION:
          this.fragments[definition.name.value] = definition;
          break;
      }
    });
    
    if (!this.operation) {
      if (operationName) {
        this.errors.push(new GraphQLError(`Unknown operation named "${operationName}".`));
      }
      else {
        this.errors.push(new GraphQLError('Must provide an operation.'));
      }
    }
    else if (hasMultipleAssumedOperations) {
      this.errors.push(new GraphQLError('Must provide operation name if query contains multiple operations.'));
    }

    // TODO: prepare variables
    this.variables = [];
  }

  hasErrors() {
    return this.errors.length === 0;
  }

  execute(rootValue) {
    const type = getOperationRootType(this.schema, this.operation);
    const fields = collectFields(this, type, this.operation.selectionSet, Object.create(null), Object.create(null));
    var path;

    try {
      return executeFields(this, type, rootValue, path, fields);
    }
    catch (error) {
      this.errors.push(error);
    }
  }
}

function execute(schema, document, root, context, variables, operation) {
  // assert missing or incorrect arguments
  // assertValidExecutionArguments(schema, document, variables);

  const exec = new ExecutionContext(schema, document, root, context, variables, operation);
  if (exec.hasErrors()) {
    return { errors: exec.errors };
  }

  const data = exec.execute();
  return exec.hasErrors() ? { errors: exec.errors, data } : { data };
}

function getOperationRootType(schema, operation) {
  switch(operation.operation) {
    case 'query':
      const queryType = schema.getQueryType();
      if (!queryType) {
        throw new GraphQLError(
          'Schema does not define the required query root type.',
          [operation]
        );
      }
      return queryType;
    case 'mutation':
      const mutationType = schema.getMutationType();
      if (!mutationType) {
        throw new GraphQLError('Schema is not configured for mutations.', [
          operation
        ]);
      }
      return mutationType;
    case 'subscription':
      const subscriptionType = schema.getSubscriptionType();
      if (!subscriptionType) {
        throw new GraphQLError('Schema is not configured for subscriptions.', [
          operation
        ]);
      }
      return subscriptionType;
    default:
      throw new GraphQLError(
        'Can only have query, mutation and subscription operations.',
        [operation]
      );
  }
}

function collectFields(exeContext, runtimeType, selectionSet, fields, visitedFragmentNames) {
  for (let i = 0; i < selectionSet.selections.length; i++) {
    const selection = selectionSet.selections[i];
    switch (selection.kind) {
      case NodeKind.FIELD:
        // TODO: re-enable
        /*if (!shouldIncludeNode(exeContext, selection)) {
          continue;
        }*/
        const name = getFieldEntryKey(selection);
        if (!fields[name]) {
          fields[name] = [];
        }
        fields[name].push(selection);
        break;
      case NodeKind.INLINE_FRAGMENT:
        // TODO: re-enable
        /*if (
          !shouldIncludeNode(exeContext, selection) ||
          !doesFragmentConditionMatch(exeContext, selection, runtimeType)
        ) {
          continue;
        }*/
        collectFields(
          exeContext,
          runtimeType,
          selection.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
      case NodeKind.FRAGMENT_SPREAD:
        const fragName = selection.name.value;
        // TODO: re-enable
        /*if (
          visitedFragmentNames[fragName] ||
          !shouldIncludeNode(exeContext, selection)
        ) {
          continue;
        }*/
        visitedFragmentNames[fragName] = true;
        const fragment = exeContext.fragments[fragName];
        // TODO: re-enable
        /*if (
          !fragment ||
          !doesFragmentConditionMatch(exeContext, fragment, runtimeType)
        ) {
          continue;
        }*/
        collectFields(
          exeContext,
          runtimeType,
          fragment.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
    }
  }
  return fields;
}

function getFieldEntryKey(node) {
  return node.alias ? node.alias.value : node.name.value;
}

function addPath(prev, key) {
  return { prev, key };
}

function executeFields(exeContext, parentType, sourceValue, path, fields) {
  const fieldKeys = Object.keys(fields);
  return fieldKeys.reduce((results, fieldKey) => {
    const fieldNodes = fields[fieldKey];
    const fieldPath = addPath(path, fieldKey);
    const result = resolveField(exeContext, parentType, sourceValue, fieldNodes, fieldPath);
    if (result === undefined) {
      return results;
    }
    results[fieldKey] = result;
    return results;
  },
  Object.create(null));
}

function resolveField(exeContext, parentType, source, fieldNodes, path) {
  const fieldNode = fieldNodes[0];
  const fieldName = fieldNode.name.value;
  const resolveFn = defaultResolver;
  const resolveInfo = {
    fieldName: fieldName,
    fieldNodes: fieldNodes,
    returnType: 'TODO',
    parentType: parentType,
    path: path,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues
  };

  try {
    const args = [];
    const contextValue = exeContext.contextValue;
    const result = resolveFn(source, args, contextValue, resolveInfo);
    return result;
  }
  catch (error) {
    return error instanceof Error ? error : new Error(error || undefined);
  }
}

function defaultResolver(source, args, contextValue, info) {
  return 'DEF_RESOLVED';
}

module.exports = {
  execute: execute
};