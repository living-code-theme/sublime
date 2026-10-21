// Native format regressions, exercised through this port's generator.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {resolveAll,ANSI_ORDER} from '../scripts/palette.mjs';
import {generate} from '../src/generate.mjs';

const flavors = resolveAll();

const sublime = {files: f=>generate([f]).filter(x=>x.path!=='living-code.json'), all: fs=>generate(fs).filter(x=>x.path==='living-code.json'||x.path==='theme.css'||x.path.startsWith('snippets/')), install:readFileSync(new URL('../README.md',import.meta.url),'utf8')};

const schemes = new Map(flavors.map((f) => [f.id, JSON.parse(sublime.files(f)[0].content)]));

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const VAR = /^var\(([^()\s]+)\)$/;

const isColor = (value) =>
  HEX.test(value) ||
  VAR.test(value) ||
  /^(?:rgba?|hsla?|hwb)\([^()]*\)$/.test(value) ||
  /^color\(var\([^()\s]+\)(?: (?:blenda?|alpha|a|saturation|s|lightness|l|min-contrast)\([^()]*(?:\([^()]*\))?[^()]*\))*\)$/.test(value);

const GLOBAL_COLOR_KEYS = new Set([
  "background", "foreground", "invisibles", "caret", "block_caret", "block_caret_border", "block_caret_underline",
  "line_highlight", "misspelling", "fold_marker", "minimap_border", "accent",
  "gutter", "gutter_foreground", "gutter_foreground_highlight",
  "line_diff_added", "line_diff_modified", "line_diff_deleted",
  "selection", "selection_foreground", "selection_border", "inactive_selection", "inactive_selection_border", "inactive_selection_foreground",
  "highlight", "find_highlight", "find_highlight_foreground", "scroll_highlight", "scroll_selected_highlight",
  "rulers", "guide", "active_guide", "stack_guide",
  "brackets_foreground", "bracket_contents_foreground", "tags_foreground", "shadow",
]);

const GLOBAL_NUMBER_KEYS = new Set(["line_diff_width", "selection_border_width", "selection_corner_radius", "block_caret_corner_radius", "shadow_width"]);

const GLOBAL_STRING_KEYS = new Map([
  ["brackets_options", ["underline", "stippled_underline", "squiggly_underline", "foreground", "bold", "italic"]],
  ["bracket_contents_options", ["underline", "stippled_underline", "squiggly_underline", "foreground"]],
  ["tags_options", ["underline", "stippled_underline", "squiggly_underline", "foreground"]],
  ["selection_corner_style", ["round", "cut", "square"]],
  ["block_caret_corner_style", ["round", "cut", "square"]],
]);

const GLOBAL_OTHER_KEYS = new Set(["popup_css", "phantom_css", "sheet_css"]);

const RULE_KEYS = new Set(["name", "scope", "foreground", "background", "foreground_adjust", "selection_foreground", "font_style"]);

const FONT_STYLES = new Set(["bold", "italic", "glow", "underline", "stippled_underline", "squiggly_underline"]);

function resolve(value, variables) {
  const m = VAR.exec(value);
  return m ? variables[m[1]] : value;
}

test("schemes parse as strict JSON with name, author, variables, globals and rules", () => {
  const names = new Set();
  for (const f of flavors) {
    const scheme = schemes.get(f.id);
    assert.deepEqual(Object.keys(scheme), ["name", "author", "variables", "globals", "rules"]);
    assert.equal(scheme.name, f.name);
    assert.equal(typeof scheme.author, "string");
    assert.ok(Array.isArray(scheme.rules) && scheme.rules.length > 0);
    names.add(scheme.name);
  }
  assert.equal(names.size, flavors.length);
  assert.deepEqual([...names], ["Living Code Night", "Living Code Frost", "Living Code Paper", "Living Code Signal"]);
});

test("every var() reference resolves and every value is a valid color or documented type", () => {
  for (const f of flavors) {
    const { variables, globals, rules } = schemes.get(f.id);
    for (const [name, value] of Object.entries(variables)) {
      assert.match(name, /^[A-Za-z0-9_]+$/);
      assert.match(value, HEX, `${f.id} variable ${name}`);
    }
    const used = new Set();
    const check = (where, value) => {
      assert.ok(isColor(value), `${f.id} ${where}: ${value}`);
      for (const [, ref] of value.matchAll(/var\(([^()\s]+)\)/g)) {
        used.add(ref);
        assert.ok(ref in variables, `${f.id} ${where}: undefined variable ${ref}`);
      }
    };
    for (const [key, value] of Object.entries(globals)) {
      if (GLOBAL_COLOR_KEYS.has(key)) check(`globals.${key}`, value);
      // Sublime rejects the whole scheme ("globals values must be strings") if a width is a JSON number.
      else if (GLOBAL_NUMBER_KEYS.has(key)) assert.match(value, /^\d+$/, key);
      else if (GLOBAL_STRING_KEYS.has(key)) {
        for (const option of value.split(" ")) assert.ok(GLOBAL_STRING_KEYS.get(key).includes(option), `${key}: ${option}`);
      } else assert.ok(GLOBAL_OTHER_KEYS.has(key), `${f.id}: unknown global ${key}`);
    }
    for (const rule of rules) {
      assert.equal(typeof rule.scope, "string");
      assert.ok(rule.scope.length > 0);
      for (const key of Object.keys(rule)) assert.ok(RULE_KEYS.has(key), `${f.id}: unknown rule key ${key}`);
      for (const key of ["foreground", "background"]) if (key in rule) check(`${rule.scope}.${key}`, rule[key]);
      if ("foreground_adjust" in rule) assert.ok("background" in rule, "foreground_adjust needs background");
      if ("font_style" in rule) {
        for (const style of rule.font_style.split(" ")) assert.ok(FONT_STYLES.has(style), `${f.id} ${rule.scope}: ${style}`);
      }
      assert.ok("foreground" in rule || "background" in rule || "font_style" in rule, `${rule.scope} has no style`);
    }
    assert.ok(used.size > 0);
  }
});

test("globals include the documented essentials and equal the resolved roles", () => {
  for (const f of flavors) {
    const { variables, globals } = schemes.get(f.id);
    const g = (key) => resolve(globals[key], variables);
    for (const key of ["background", "foreground", "caret", "selection", "line_highlight", "gutter", "gutter_foreground", "find_highlight", "guide", "active_guide", "stack_guide", "misspelling", "shadow", "accent"]) {
      assert.ok(key in globals, `${f.id}: missing global ${key}`);
    }
    assert.equal(g("background"), f.r("bg"));
    assert.equal(g("foreground"), f.r("fg"));
    assert.equal(g("caret"), f.r("cursor"));
    assert.equal(g("line_highlight"), f.r("lineHighlight"));
    assert.equal(g("selection"), f.r("selection"));
    assert.equal(g("gutter"), f.r("bg"));
    assert.equal(g("gutter_foreground"), f.r("lineNumber"));
    assert.equal(g("gutter_foreground_highlight"), f.r("lineNumberActive"));
    assert.equal(g("find_highlight"), f.r("match"));
    assert.equal(g("brackets_foreground"), f.r("accent"));
    assert.equal(g("accent"), f.r("accent"));
    assert.equal(g("misspelling"), f.r("error"));
    assert.equal(g("line_diff_added"), f.r("added"));
    assert.equal(g("line_diff_modified"), f.r("modified"));
    assert.equal(g("line_diff_deleted"), f.r("removed"));
    assert.equal(g("guide"), f.c("surface0"));
    assert.equal(g("active_guide"), f.c("surface2"));
    // Palette and role variables match the flavor exactly.
    for (const name of Object.keys(f.colors)) assert.equal(variables[name], f.c(name), `${f.id} ${name}`);
    for (const role of Object.keys(f.roles)) assert.equal(variables[`role_${role}`], f.r(role), `${f.id} role_${role}`);
  }
});
