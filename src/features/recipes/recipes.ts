import type { Db } from '../../storage/migrations';
import { parseAmount, type Nutrition, type Portion } from '../diary/diary.ts';
import { logPortion, type Food } from '../foods/foods.ts';

// A saved food's nutrients per 100 g as they were when it was added, and the grams used.
// `serving` records an amount entered as servings of that food, for display; grams is what counts.
export type Ingredient = Nutrition & {
  foodId: number;
  name: string;
  grams: number;
  serving: { name: string; count: number } | null;
};
// finishedGrams is the edible weight after cooking, which the ingredients' nutrients spread over.
export type RecipeInput = { name: string; finishedGrams: number; ingredients: Ingredient[] };
export type Recipe = RecipeInput & { id: number };
export type RecipeForm = { name: string; finishedGrams: string };
export type RecipeFormErrors = Partial<Record<keyof RecipeForm | 'ingredients', string>>;

type IngredientRow = Omit<Ingredient, 'serving'> & { recipeId: number; servings: number | null; servingName: string | null };

const nutrients = ['calories', 'protein', 'carbs', 'fat'] as const;
const ingredientColumns = `recipe_id AS recipeId, food_id AS foodId, name, grams, servings,
  serving_name AS servingName, calories, protein, carbs, fat`;

/**
 * Snapshots `quantity` grams or servings of a saved food as an ingredient. Only per-100 g foods
 * qualify: millilitres never become grams without a density, which a food lacks.
 */
export function ingredientOf(food: Food, quantity: number, unit: 'g' | 'serving'): { ingredient: Ingredient } | { error: string } {
  if (food.basis !== 'g') {
    return { error: `${food.name} is measured per 100 ml. Recipes are weighed in grams, and its density is unknown.` };
  }
  const checked = logPortion(food, quantity, unit);
  if ('error' in checked) return checked;
  const { id, name, calories, protein, carbs, fat } = food;
  return {
    ingredient: {
      foodId: id, name, grams: checked.portion.amount, calories, protein, carbs, fat,
      serving: unit === 'serving' ? { name: food.serving!.name, count: quantity } : null,
    },
  };
}

/** The whole recipe's nutrition. A nutrient that any ingredient lacks is unknown for the recipe. */
export function recipeTotal(ingredients: Ingredient[]): Nutrition {
  const sum = (key: (typeof nutrients)[number]) => (ingredients.some((i) => i[key] === null)
    ? null : ingredients.reduce((total, i) => total + (i[key]! * i.grams) / 100, 0));
  return { calories: sum('calories')!, protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') };
}

/** Validates the recipe form at the input boundary. The finished weight must be above 0 g. */
export function parseRecipeForm(form: RecipeForm, ingredients: Ingredient[]): { recipe: RecipeInput } | { errors: RecipeFormErrors } {
  const errors: RecipeFormErrors = {};
  const name = form.name.trim();
  if (name === '') errors.name = 'Name is required';
  const finishedGrams = parseAmount(form.finishedGrams); // → number | null (blank) | undefined (invalid)
  if (!finishedGrams) errors.finishedGrams = 'Enter the finished weight above 0 g';
  if (ingredients.length === 0) errors.ingredients = 'Add at least one ingredient';
  if (Object.keys(errors).length > 0) return { errors };
  return { recipe: { name, finishedGrams: finishedGrams!, ingredients } };
}

/** Snapshots `grams` of the finished recipe as diary nutrition: the total over finished weight. */
export function logRecipe(recipe: Recipe, grams: number): { nutrition: Nutrition; portion: Portion } | { error: string } {
  if (!(grams > 0 && Number.isFinite(grams))) return { error: 'Enter an amount above 0' };
  const total = recipeTotal(recipe.ingredients);
  const at = (v: number | null) => (v === null ? null : (v * grams) / recipe.finishedGrams);
  return {
    nutrition: { calories: at(total.calories)!, protein: at(total.protein), carbs: at(total.carbs), fat: at(total.fat) },
    // ponytail: recipe entries keep no recipe id; add a recipe_id column when a feature must find a recipe's logs.
    portion: { foodId: null, amount: grams, unit: 'g' },
  };
}

/** Every recipe by name, with its ingredients in the order they were added. */
export async function listRecipes(db: Db): Promise<Recipe[]> {
  const recipes = await db.getAllAsync<Omit<Recipe, 'ingredients'>>(
    'SELECT id, name, finished_grams AS finishedGrams FROM recipes ORDER BY name COLLATE NOCASE, id', [],
  );
  const rows = await db.getAllAsync<IngredientRow>(`SELECT ${ingredientColumns} FROM recipe_ingredients ORDER BY id`, []);
  return recipes.map((r) => ({
    ...r,
    ingredients: rows.filter((i) => i.recipeId === r.id).map(({ recipeId: _, servings, servingName, ...i }) => ({
      ...i,
      serving: servingName === null ? null : { name: servingName, count: servings! }, // the schema sets both together
    })),
  }));
}

async function transaction(db: Db, action: () => Promise<void>): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await action();
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

async function insertIngredients(db: Db, recipeId: number, ingredients: Ingredient[]): Promise<void> {
  for (const i of ingredients) {
    await db.runAsync(
      `INSERT INTO recipe_ingredients (recipe_id, food_id, name, grams, servings, serving_name, calories, protein, carbs, fat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recipeId, i.foodId, i.name, i.grams, i.serving?.count ?? null, i.serving?.name ?? null, i.calories, i.protein, i.carbs, i.fat],
    );
  }
}

/**
 * Saves a recipe and its ingredient snapshots in one transaction.
 * @returns The new recipe's id.
 * @throws If the storage CHECK or foreign key constraints reject the values; nothing is saved.
 */
export async function insertRecipe(db: Db, r: RecipeInput): Promise<number> {
  let id = 0;
  await transaction(db, async () => {
    ({ lastInsertRowId: id } = await db.runAsync('INSERT INTO recipes (name, finished_grams) VALUES (?, ?)', [r.name, r.finishedGrams]));
    await insertIngredients(db, id, r.ingredients);
  });
  return id;
}

/**
 * Replaces a recipe's name, finished weight, and ingredients, for future logs only. Logged
 * portions keep their snapshots.
 * @throws If the storage constraints reject the values; the recipe stays as it was.
 */
export async function updateRecipe(db: Db, id: number, r: RecipeInput): Promise<void> {
  await transaction(db, async () => {
    await db.runAsync('UPDATE recipes SET name = ?, finished_grams = ? WHERE id = ?', [r.name, r.finishedGrams, id]);
    await db.runAsync('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [id]);
    await insertIngredients(db, id, r.ingredients);
  });
}
