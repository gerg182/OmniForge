'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  MAX_RECIPES,
  MAX_RECIPE_NAME,
  sanitizeRecipeOptions,
  sanitizeRecipe,
  sanitizeRecipes
} = require('../src/main/recipes');
const { Store } = require('../src/main/store');

test('recipe sanitization strips secrets and path-bound options', () => {
  const recipe = sanitizeRecipe({
    id: 'recipe-1',
    name: '  Clean   podcast  ',
    tool: 'COMPRESS',
    options: {
      quality: 'small',
      resolution: '720',
      password: 'do-not-store',
      confirm: 'do-not-store',
      outputDir: 'C:\\private',
      inputPaths: ['C:\\private\\source.mp4'],
      url: 'https://example.com/private',
      acknowledged: true,
      keep: ['sha256', 'md5']
    }
  });
  assert.equal(recipe.name, 'Clean podcast');
  assert.equal(recipe.tool, 'compress');
  assert.deepEqual(recipe.options, { quality: 'small', resolution: '720', keep: ['sha256', 'md5'] });
  assert.equal(JSON.stringify(recipe).includes('do-not-store'), false);
  assert.equal(JSON.stringify(recipe).includes('private'), false);
});

test('recipe sanitization enforces names, tools, option limits, and deduplication', () => {
  assert.equal(sanitizeRecipe({ name: 'x', tool: 'shred', options: {} }), null);
  assert.equal(sanitizeRecipe({ name: '', tool: 'convert', options: {} }), null);
  const oversized = Object.fromEntries(Array.from({ length: 30 }, (_value, index) => [`option${index}`, 'x'.repeat(500)]));
  assert.equal(sanitizeRecipe({ name: 'x', tool: 'convert', options: oversized }), null);
  assert.equal(MAX_RECIPE_NAME, 40);
  const name = 'n'.repeat(80);
  const recipe = sanitizeRecipe({ name, tool: 'convert', options: { targetFormat: 'mp4' } });
  assert.equal(recipe.name.length, 40);

  const deduplicated = sanitizeRecipes([
    { id: 'a', name: 'Same', tool: 'convert', options: { targetFormat: 'mp4' } },
    { id: 'b', name: 'same', tool: 'convert', options: { targetFormat: 'mkv' } }
  ]);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].options.targetFormat, 'mkv');

  const recipes = sanitizeRecipes(Array.from({ length: MAX_RECIPES + 3 }, (_value, index) => ({
    id: `r-${index}`,
    name: `Recipe ${index}`,
    tool: 'compress',
    options: { quality: 'balanced' }
  })));
  assert.equal(recipes.length, MAX_RECIPES);
});

test('recipe options reject non-objects and unsafe nesting', () => {
  assert.equal(sanitizeRecipeOptions(null), null);
  assert.equal(sanitizeRecipeOptions([]), null);
  assert.deepEqual(sanitizeRecipeOptions({ nested: { secret: true }, count: 3, valid: false }), { count: 3, valid: false });
});

test('settings save and older settings load both sanitize recipes', (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-recipes-store-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const app = { getPath: () => folder };
  const store = new Store(app);
  assert.deepEqual(store.get().recipes, []);
  store.save({
    recipes: [{
      name: 'Private preset',
      tool: 'convert',
      options: { targetFormat: 'webm', password: 'secret', outputDir: folder }
    }]
  });
  const stored = JSON.parse(fs.readFileSync(path.join(folder, 'settings.json'), 'utf8'));
  assert.deepEqual(stored.recipes[0].options, { targetFormat: 'webm' });
  assert.equal(JSON.stringify(stored).includes('secret'), false);

  fs.writeFileSync(path.join(folder, 'settings.json'), JSON.stringify({
    outputDir: folder,
    recipes: [{ name: 'Legacy', tool: 'checksum', options: { algorithms: ['sha256'], confirm: 'no' } }]
  }), 'utf8');
  const loaded = new Store(app);
  assert.deepEqual(loaded.get().recipes[0].options, { algorithms: ['sha256'] });
});
