'use strict';

function inspect(value) {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'function':
      return value.name ? `[function ${value.name}]` : '[function]';
    case 'object':
      if (value) {
        //const customInspectFn = value[String(nodejsCustomInspectSymbol)];
        const customInspectFn = undefined; // reference implementation uses node's util.inspect function
        if (typeof customInspectFn === 'function') {
          return customInspectFn();
        } else if (typeof value.inspect === 'function') {
          return value.inspect();
        } else if (Array.isArray(value)) {
          return '[' + value.map(inspect).join(', ') + ']';
        }

        const properties = Object.keys(value)
          .map(k => `${k}: ${inspect(value[k])}`)
          .join(', ');
        return properties ? '{ ' + properties + ' }' : '{}';
      }
      return String(value);
    default:
      return String(value);
  }
}

module.exports = {
  inspect: inspect
};