// This port owns its application mappings. Inputs come only from the pinned local palette.
import { SCOPES } from "./scopes.mjs";

const SUBLIME_AUTHOR = "Living Code";

const SUBLIME_SCOPES = [
  { role: "accent", scope: ["entity.name.filename.find-in-files"] },
  { role: "lineNumber", scope: ["constant.numeric.line-number.find-in-files"] },
];


const rule = (name, scope, props) => ({ name, scope: scope.join(", "), ...props });

const FONT_STYLES = new Set(["bold", "italic", "underline"]);

function sublimeScheme(f) {
  const palette = Object.fromEntries(Object.keys(f.colors).map((n) => [n, f.c(n)]));
  const roles = Object.fromEntries(Object.keys(f.roles).map((r) => [`role_${r}`, f.r(r)]));
  // Tints for diff backgrounds and the unfocused selection, from the same roles
  // the delta and Neovim ports blend.
  const tints = {
    tint_added: f.mix("bg", "added", 0.14),
    tint_removed: f.mix("bg", "removed", 0.14),
    tint_modified: f.mix("bg", "modified", 0.12),
    selection_inactive: f.mix("bg", "selection", 0.6),
  };
  const variables = { ...palette, ...roles, ...tints };
  const v = (name) => `var(${name})`;
  const role = (r) => v(`role_${r}`);

  const globals = {
    background: role("bg"),
    foreground: role("fg"),
    caret: role("cursor"),
    block_caret: role("cursor"),
    invisibles: v("surface1"),
    line_highlight: role("lineHighlight"),
    misspelling: role("error"),
    fold_marker: role("fgSubtle"),
    minimap_border: role("border"),
    accent: role("accent"),
    shadow: "#00000033",
    shadow_width: "8",

    gutter: role("bg"),
    gutter_foreground: role("lineNumber"),
    gutter_foreground_highlight: role("lineNumberActive"),
    line_diff_width: "3",
    line_diff_added: role("added"),
    line_diff_modified: role("modified"),
    line_diff_deleted: role("removed"),

    selection: role("selection"),
    inactive_selection: v("selection_inactive"),

    highlight: role("match"),
    find_highlight: role("match"),
    find_highlight_foreground: role("bg"),
    scroll_highlight: role("match"),
    scroll_selected_highlight: role("accent"),

    rulers: v("surface0"),
    guide: v("surface0"),
    stack_guide: v("surface1"),
    active_guide: v("surface2"),

    brackets_options: "underline",
    brackets_foreground: role("accent"),
    bracket_contents_options: "underline",
    bracket_contents_foreground: role("fgMuted"),
    tags_options: "stippled_underline",
    tags_foreground: role("accent"),
  };

  const style = (r, fontStyle) => {
    const s = (fontStyle ?? (r && f.styles[r]))?.split(" ").filter((x) => FONT_STYLES.has(x)).join(" ");
    return s ? { font_style: s } : {};
  };
  const fromScopes = (list) =>
    list
      .map(({ role: r, scope, fontStyle }) => rule(r ?? scope[0], scope, { ...(r ? { foreground: role(r) } : {}), ...style(r, fontStyle) }))
      .filter((x) => x.foreground || x.font_style);

  const diff = (kind, r, tint) => rule(`diff ${kind}`, [`markup.${kind}.diff`], { foreground: role(r), background: v(tint) });

  const rules = [
    ...fromScopes(SCOPES),
    ...fromScopes(SUBLIME_SCOPES),
    diff("inserted", "added", "tint_added"),
    diff("deleted", "removed", "tint_removed"),
    diff("changed", "modified", "tint_modified"),
  ];

  return { name: f.name, author: SUBLIME_AUTHOR, variables, globals, rules };
}

const sublime = {
files: (f) => [{ path: `${f.slug}.sublime-color-scheme`, content: JSON.stringify(sublimeScheme(f), null, 2) + "\n" }]
};

export function generate(flavors) {
  return [...flavors.flatMap(f => sublime.files(f)), ...(sublime.all?.(flavors) ?? [])].filter(f => !["LICENSE", "README.md", "package.json", "extension.toml"].includes(f.path.split("/").at(-1)));
}
