import { format } from "prettier";
import beautify from "js-beautify";
import { parse } from "acorn";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const options = {
  indent_size: 2,
  preserve_newlines: true,
  max_preserve_newlines: 2,
  wrap_line_length: 120,
  end_with_newline: true,
  unescape_strings: false,
};

function tree(source) {
  return JSON.stringify(
    parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowReturnOutsideFunction: true,
      allowHashBang: true,
    }),
    function (key, value) {
      if (key === "start" || key === "end" || (key === "raw" && this.type === "Literal"))
        return undefined;
      if (key === "body" && Array.isArray(value))
        return value.filter((node) => node.type !== "EmptyStatement");
      return typeof value === "bigint" ? String(value) : value;
    },
  );
}

export async function formatJavaScript(source) {
  const formatted = await format(source, {
    parser: "babel",
    quoteProps: "preserve",
    embeddedLanguageFormatting: "off",
    tabWidth: 2,
    printWidth: 100,
    endOfLine: "lf",
  });
  if (tree(source) !== tree(formatted))
    throw Error("Formatting changed JavaScript syntax or values");
  return formatted;
}

export function formatCss(source) {
  return beautify.css(source, options);
}

async function formatSources() {
  const result = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw Error("Unable to list source files");
  const files = [...new Set(result.stdout.split("\0"))].filter(
    (file) =>
      /\.(?:js|mjs|css)$/.test(file) &&
      (/^(?:apps|js|css|assets)\//.test(file) ||
        ["script.js", "startup.js", "styles.css"].includes(file)) &&
      !/^assets\/(?:vendor|ugs)\//.test(file),
  );
  let count = 0;
  for (const file of files) {
    const source = await readFile(file, "utf8");
    let formatted;
    try {
      formatted = file.endsWith(".css") ? formatCss(source) : await formatJavaScript(source);
    } catch (error) {
      throw new Error(file + ": " + error.message, { cause: error });
    }
    if (formatted !== source) {
      await writeFile(file, formatted);
      count++;
    }
  }
  console.log(
    `Formatted ${count} first-party source files; JavaScript syntax and values verified unchanged.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href &&
  process.argv.includes("--source")
) {
  await formatSources();
}
