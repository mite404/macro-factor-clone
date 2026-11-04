import assert from 'node:assert/strict';
import { test } from 'node:test';

import { migrate, type Db } from '../../storage/migrations.ts';
import { openTestDb } from '../../storage/testDb.ts';
import { insertEntry, listEntries } from '../diary/diary.ts';
import { insertFood, updateFood, type Food, type FoodInput } from '../foods/foods.ts';
import { ingredientOf, insertRecipe, listRecipes, logRecipe, parseRecipeForm, updateRecipe, type Ingredient, type RecipeInput } from './recipes.ts';

const day = '2026-11-04';
const chickenInput: FoodInput = { name: 'Chicken', basis: 'g', calories: 120, protein: 20, carbs: 0, fat: 2, serving: null, barcode: null };
const riceInput: FoodInput = { name: 'Rice', basis: 'g', calories: 150, protein: 2.5, carbs: 33, fat: null, serving: { name: 'cup', amount: 160 }, barcode: null };

async function saved(db: Db, input: FoodInput): Promise<Food> {
  return { ...input, brand: null, source: null, id: await insertFood(db, input) };
}

function ingredient(food: Food, quantity: number, unit: 'g' | 'serving'): Ingredient {
  const result = ingredientOf(food, quantity, unit);
  assert.ok('ingredient' in result, JSON.stringify(result));
  return result.ingredient;
}

function recipe(form: { name: string; finishedGrams: string }, ingredients: Ingredient[]): RecipeInput {
  const result = parseRecipeForm(form, ingredients);
  assert.ok('recipe' in result, JSON.stringify(result));
  return result.recipe;
}

// Chicken 250 g = 300 kcal, 50 g protein; rice 2.5 cups = 400 g = 600 kcal, 10 g protein.
async function stew(db: Db) {
  const chicken = await saved(db, chickenInput);
  const rice = await saved(db, riceInput);
  const input = recipe({ name: ' Chicken rice ', finishedGrams: '600' }, [ingredient(chicken, 250, 'g'), ingredient(rice, 2.5, 'serving')]);
  return { chicken, rice, id: await insertRecipe(db, input) };
}

async function logged(db: Db, id: number, grams: number) {
  const found = (await listRecipes(db)).find((r) => r.id === id)!;
  const result = logRecipe(found, grams);
  assert.ok('portion' in result, JSON.stringify(result));
  await insertEntry(db, { day, label: found.name, ...result.nutrition }, result.portion);
}

test('a portion is scaled by finished weight, not raw ingredient weight', async () => {
  const { db, close } = openTestDb(':memory:');
  await migrate(db);
  const { chicken, rice, id } = await stew(db);

  const [stored] = await listRecipes(db);
  assert.deepEqual(JSON.parse(JSON.stringify(stored)), {
    id, name: 'Chicken rice', finishedGrams: 600,
    ingredients: [
      { foodId: chicken.id, name: 'Chicken', grams: 250, serving: null, calories: 120, protein: 20, carbs: 0, fat: 2 },
      { foodId: rice.id, name: 'Rice', grams: 400, serving: { name: 'cup', count: 2.5 }, calories: 150, protein: 2.5, carbs: 33, fat: null },
    ],
  });
  await logged(db, id, 150);

  const [entry] = await listEntries(db, day);
  assert.deepEqual({ ...entry, portion: { ...entry.portion } }, {
    id: entry.id, day, label: 'Chicken rice', calories: 225, protein: 15, carbs: 33, fat: null,
    portion: { foodId: null, amount: 150, unit: 'g' },
  });
  close();
});

test('rejects recipes without a positive finished weight and ingredients without grams', async () => {
  const { db, close } = openTestDb(':memory:');
  await migrate(db);
  const chicken = await saved(db, chickenInput);
  const juice = await saved(db, { ...chickenInput, name: 'Juice', basis: 'ml', serving: { name: 'glass', amount: 240 } });
  const one = [ingredient(chicken, 100, 'g')];

  assert.deepEqual(parseRecipeForm({ name: 'Stew', finishedGrams: '0' }, one), { errors: { finishedGrams: 'Enter the finished weight above 0 g' } });
  assert.ok('errors' in parseRecipeForm({ name: 'Stew', finishedGrams: '' }, one), 'blank finished weight');
  assert.ok('errors' in parseRecipeForm({ name: 'Stew', finishedGrams: '-5' }, one), 'negative finished weight');
  assert.deepEqual(Object.keys((parseRecipeForm({ name: ' ', finishedGrams: '300' }, []) as { errors: object }).errors), ['name', 'ingredients']);
  assert.match((ingredientOf(juice, 100, 'g') as { error: string }).error, /per 100 ml/);
  assert.match((ingredientOf(juice, 1, 'serving') as { error: string }).error, /per 100 ml/);
  assert.ok('error' in ingredientOf(chicken, 1, 'serving'), 'serving the food does not define');
  assert.ok('error' in ingredientOf(chicken, 0, 'g'), 'zero grams');
  assert.ok('error' in logRecipe({ id: 1, ...recipe({ name: 'Stew', finishedGrams: '300' }, one) }, 0), 'zero portion');
  await assert.rejects(insertRecipe(db, { name: 'Stew', finishedGrams: 0, ingredients: one }), 'storage rejects zero finished weight');
  assert.deepEqual(await listRecipes(db), [], 'a rejected insert leaves no recipe behind');
  close();
});

test('an ingredient without protein makes the recipe protein unknown, not lower', async () => {
  const chicken = { ...chickenInput, brand: null, source: null, id: 1 };
  const bar = { ...chickenInput, name: 'Bar', protein: null, id: 2, brand: null, source: null };
  const result = logRecipe({ id: 1, ...recipe({ name: 'Mix', finishedGrams: '200' }, [ingredient(chicken, 100, 'g'), ingredient(bar, 100, 'g')]) }, 100);
  assert.ok('nutrition' in result);
  assert.deepEqual(result.nutrition, { calories: 120, protein: null, carbs: 0, fat: 2 });
});

test('food edits leave recipe snapshots alone, and recipe edits leave logged portions alone', async () => {
  const { db, close } = openTestDb(':memory:');
  await migrate(db);
  const { chicken, id } = await stew(db);
  await logged(db, id, 150);

  await updateFood(db, chicken.id, { ...chickenInput, calories: 999, protein: 1 });
  const [kept] = await listRecipes(db);
  assert.deepEqual([kept.ingredients[0].calories, kept.ingredients[0].protein], [120, 20]);

  // Changing only the finished weight keeps every ingredient snapshot.
  await updateRecipe(db, id, recipe({ name: 'Chicken rice', finishedGrams: '500' }, kept.ingredients));
  const [edited] = await listRecipes(db);
  assert.deepEqual(JSON.parse(JSON.stringify(edited.ingredients)), JSON.parse(JSON.stringify(kept.ingredients)));
  await logged(db, id, 150);

  assert.deepEqual((await listEntries(db, day)).map((e) => [e.calories, e.protein]), [[225, 15], [270, 18]]);
  close();
});
