import { parse } from "acorn";
export function encodeLiterals(source, module = false) {
  const λεκτικά = [];
  const ast = parse(source, {
      ecmaVersion: "latest",
      sourceType: module ? "module" : "script",
      allowHashBang: true,
      onToken: λεκτικά,
    }),
    edits = [];
  const προηγούμενα = new Map(
    λεκτικά
      .slice(1)
      .map((λεκτικό, θέση) => [λεκτικό.start, λεκτικά[θέση].start]),
  );
  const encodedString = (value) =>
    '"' +
    Array.from(
      { length: value.length },
      (_, i) => "\\u" + value.charCodeAt(i).toString(16).padStart(4, "0"),
    ).join("") +
    '"';
  function visit(node, parent) {
    if (!node || typeof node !== "object") return;
    if (node.type === "ExpressionStatement" && node.directive) return;
    if (
      node.type === "Literal" &&
      typeof node.value === "string" &&
      node.value.length <= 4096
    ) {
      edits.push({
        start: node.start,
        end: node.end,
        text: encodedString(node.value),
      });
      return;
    }
    if (
      node.type === "MemberExpression" &&
      !node.computed &&
      node.property.type === "Identifier"
    ) {
      edits.push({
        start: προηγούμενα.get(node.property.start),
        end: node.end,
        text:
          (node.optional ? "?." : "") +
          "[" +
          encodedString(node.property.name) +
          "]",
      });
    }
    if (
      node.type === "Property" &&
      !node.computed &&
      !node.shorthand &&
      !node.method &&
      node.kind === "init" &&
      node.key.type === "Identifier"
    ) {
      edits.push({
        start: node.key.start,
        end: node.key.end,
        text: encodedString(node.key.name),
      });
    }
    if (
      node.type === "TemplateLiteral" &&
      parent?.type !== "TaggedTemplateExpression"
    ) {
      for (const quasi of node.quasis)
        if (quasi.value.cooked != null && quasi.value.cooked.length <= 4096)
          edits.push({
            start: quasi.start,
            end: quasi.end,
            text: encodedString(quasi.value.cooked).slice(1, -1),
          });
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((child) => visit(child, node));
      else if (value && typeof value === "object") visit(value, node);
    }
  }
  visit(ast);
  for (const edit of edits.sort((a, b) => b.start - a.start))
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  return source;
}
