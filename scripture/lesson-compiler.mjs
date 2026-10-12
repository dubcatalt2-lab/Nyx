import {parse} from 'acorn';

export function compile(parameters, body) {
  if (!Array.isArray(parameters) || parameters.some(name => typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) || new Set(parameters).size !== parameters.length) throw new TypeError('Invalid compiler parameters');
  if (typeof body !== 'string') throw new TypeError('Invalid compiler body');
  return new Function(...parameters, body);
}

export function evaluateGlobal(source) {
  return (0, eval)(String(source));
}

export function run(source, bindings = {}) {
  const code = String(source);
  const tree = parse(code, {ecmaVersion:'latest', sourceType:'script'});
  const last = tree.body.at(-1);
  const body = last?.type === 'ExpressionStatement'
    ? code.slice(0, last.start) + 'return (' + code.slice(last.expression.start, last.expression.end) + ');'
    : code;
  const parameters = Object.keys(bindings);
  return compile(parameters, body)(...parameters.map(name => bindings[name]));
}

function keys(path) {
  const expression = parse('value' + path, {ecmaVersion:'latest'}).body;
  if (expression.length !== 1 || expression[0].type !== 'ExpressionStatement') throw new TypeError('Invalid property path');
  const result = [];
  let node = expression[0].expression;
  while (node.type === 'MemberExpression' && !node.optional) {
    const key = node.computed ? node.property.type === 'Literal' ? node.property.value : undefined : node.property.name;
    if (!['string','number'].includes(typeof key)) throw new TypeError('Invalid property key');
    result.unshift(key); node = node.object;
  }
  if (node.type !== 'Identifier' || node.name !== 'value' || !result.length) throw new TypeError('Invalid property path');
  return result;
}

export function coordinates(point, paths) {
  return paths.map(path => keys(path).reduce((value, key) => value[key], point));
}

export function point(coordinates, paths) {
  const result = {};
  paths.forEach((path, index) => {
    const parts = keys(path);
    const key = parts.pop();
    const target = parts.reduce((value, key) => value[key], result);
    Object.defineProperty(target, key, {value:coordinates[index], enumerable:true, writable:true, configurable:true});
  });
  return result;
}
