'use strict';

const crypto = require('crypto');

const RECIPE_TOOLS = [
  'youtube',
  'convert',
  'compress',
  'trim',
  'join',
  'extract',
  'normalize',
  'gif',
  'frames',
  'pdf',
  'archive',
  'checksum',
  'transcribe'
];

const MAX_RECIPES = 30;
const MAX_RECIPE_NAME = 40;
const MAX_RECIPE_OPTIONS_BYTES = 8 * 1024;
const FORBIDDEN_OPTION_KEYS = new Set([
  'password',
  'confirm',
  'acknowledged',
  'acknowledgement',
  'url',
  'outputdir',
  'outputdirectory',
  'inputpaths',
  'mediapath',
  'project',
  'clips',
  'segments',
  'recording'
]);

function cleanTimestamp(value, fallback) {
  const text = String(value || '').trim();
  return text && !Number.isNaN(Date.parse(text)) ? text : fallback;
}

function sanitizeOptionValue(value) {
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, 32)
      .map((entry) => {
        if (typeof entry === 'string') return entry.slice(0, 120);
        if (typeof entry === 'boolean') return entry;
        if (typeof entry === 'number') return Number.isFinite(entry) ? entry : undefined;
        return undefined;
      })
      .filter((entry) => entry !== undefined);
  }
  return undefined;
}

function sanitizeRecipeOptions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const clean = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = String(key).toLowerCase();
    if (FORBIDDEN_OPTION_KEYS.has(normalizedKey)) continue;
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(String(key))) continue;
    const safe = sanitizeOptionValue(value);
    if (safe !== undefined) clean[key] = safe;
  }
  if (Buffer.byteLength(JSON.stringify(clean), 'utf8') > MAX_RECIPE_OPTIONS_BYTES) return null;
  return clean;
}

function sanitizeRecipe(input, now = new Date().toISOString()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const tool = String(input.tool || '').trim().toLowerCase();
  if (!RECIPE_TOOLS.includes(tool)) return null;
  const name = String(input.name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_RECIPE_NAME);
  if (!name) return null;
  const options = sanitizeRecipeOptions(input.options);
  if (!options) return null;
  const id = String(input.id || '').trim().slice(0, 80) || crypto.randomUUID();
  return {
    id,
    name,
    tool,
    options,
    createdAt: cleanTimestamp(input.createdAt, now),
    updatedAt: cleanTimestamp(input.updatedAt, now)
  };
}

function sanitizeRecipes(input, now = new Date().toISOString()) {
  if (!Array.isArray(input)) return [];
  const recipes = new Map();
  for (const entry of input.slice(0, MAX_RECIPES)) {
    const recipe = sanitizeRecipe(entry, now);
    if (!recipe) continue;
    const key = `${recipe.tool}\u0000${recipe.name.toLowerCase()}`;
    if (recipes.has(key)) recipes.delete(key);
    recipes.set(key, recipe);
  }
  return [...recipes.values()].slice(0, MAX_RECIPES);
}

module.exports = {
  RECIPE_TOOLS,
  MAX_RECIPES,
  MAX_RECIPE_NAME,
  MAX_RECIPE_OPTIONS_BYTES,
  sanitizeRecipeOptions,
  sanitizeRecipe,
  sanitizeRecipes
};
