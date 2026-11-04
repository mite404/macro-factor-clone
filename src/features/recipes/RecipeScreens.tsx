// The logger's Recipes tab and recipe detail share the dark sheet with FoodSearch and FoodDetail.
// The builder and its ingredient picker follow the light "Build your recipe" reference
// (storybook/ProgramScreens.tsx RecipeBuilder) and CreateFood: title bar, heading, fields, pinned Save.
import { Pressable, TextInput, View } from 'react-native';

import { Button, Card, Field, Label, Macros, palettes, Phone, Row, Segments, usePalette } from '../../ui';
import type { Nutrition, Portion } from '../diary/diary';
import {
  Chevron, describe, FoodRow, LoggerBody, LoggerFooter, LoggerHeader, round, servingText, type LoggerTab,
} from '../diary/LoggingScreens';
import type { Food } from '../foods/foods';
import { recipeTotal, type Ingredient, type Recipe, type RecipeForm, type RecipeFormErrors } from './recipes';

const grams = (n: number | null) => (n === null ? '?' : `${round(n)}`);
const per100 = (r: Recipe) => {
  const total = recipeTotal(r.ingredients);
  const at = (v: number | null) => (v === null ? null : (v * 100) / r.finishedGrams);
  return { calories: at(total.calories)!, protein: at(total.protein), carbs: at(total.carbs), fat: at(total.fat) };
};
const rawGrams = (ingredients: Ingredient[]) => ingredients.reduce((sum, i) => sum + i.grams, 0);
const amountText = (i: Ingredient) => (i.serving ? `${round(i.serving.count)} ${i.serving.name} (${round(i.grams)} g)` : `${round(i.grams)} g`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const LIMIT = 'Finished weight corrects for water lost or gained in cooking, not for nutrients lost, such as drained fat.';

// Which ingredients leave each unknown macro unknown, as sentences. Status is text, not color alone.
function unknownMacros(ingredients: Ingredient[]): string[] {
  return (['protein', 'carbs', 'fat'] as const).flatMap((key) => {
    const names = ingredients.filter((i) => i[key] === null).map((i) => i.name);
    return names.length === 0 ? [] : [`${names.join(', ')} ${names.length === 1 ? 'has' : 'have'} no ${key} value, so this recipe's ${key} is unknown.`];
  });
}

function Warnings({ ingredients }: { ingredients: Ingredient[] }) {
  const p = usePalette();
  return unknownMacros(ingredients).map((text) => <Label key={text} size={12} style={{ color: p.warning }}>{text}</Label>);
}

// One ingredient: its name, the nutrition of the amount used, and the amount. `onRemove` adds a remove button.
function IngredientRow({ ingredient, first, onRemove }: { ingredient: Ingredient; first: boolean; onRemove?: () => void }) {
  const p = usePalette();
  const n: Nutrition = recipeTotal([ingredient]);
  return <Row style={{ gap: 12, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderColor: p.border }}>
    <View style={{ flex: 1, gap: 3 }}>
      <Label size={13}>{ingredient.name}</Label>
      <Label size={11} muted>{describe(n)}</Label>
    </View>
    {onRemove ? <Button label={`Remove ${ingredient.name}, ${amountText(ingredient)}`} onPress={onRemove}>{amountText(ingredient)}  ×</Button>
      : <Label size={12}>{amountText(ingredient)}</Label>}
  </Row>;
}

/** The logger's Recipes tab: every saved recipe, per 100 g of finished weight. */
export function RecipeList({ summary, recipes, onRecipe, onNew, onClose, onTab }: {
  summary: string; recipes: Recipe[]; onRecipe: (recipe: Recipe) => void; onNew: () => void;
  onClose: () => void; onTab: (tab: LoggerTab) => void;
}) {
  const p = palettes.dark; // read outside Phone, so usePalette would give the light default
  return <Phone dark header={<LoggerHeader active="Recipes" summary={summary} onClose={onClose} onTab={onTab} />}
    footer={<LoggerFooter><Button primary label="New recipe" onPress={onNew}>New Recipe</Button></LoggerFooter>}>
    <View style={{ padding: 16, backgroundColor: p.surface, flexGrow: 1 }}>
      <Label>Recipes</Label>
      {recipes.map((r) => {
        const n = per100(r);
        return <Pressable key={r.id} accessibilityRole="button"
          accessibilityLabel={`${r.name}, ${round(n.calories)} kilocalories per 100 grams, makes ${round(r.finishedGrams)} grams`}
          accessibilityHint="Log a portion of this recipe" onPress={() => onRecipe(r)}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, minHeight: 44,
            borderBottomWidth: 1, borderColor: p.border }, pressed && { opacity: 0.5 }]}>
          <View style={{ flex: 1, gap: 3 }}><Label size={13}>{r.name}</Label>
            <Label size={11} muted>{describe(n)}  ·  {'100\u00a0'}g</Label>
            <Label size={11} muted>Makes {round(r.finishedGrams)} g  ·  {plural(r.ingredients.length, 'ingredient', 'ingredients')}</Label></View>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.field, alignItems: 'center', justifyContent: 'center' }}>
            <Label>+</Label>
          </View>
        </Pressable>;
      })}
      {recipes.length === 0 ? <Label muted style={{ paddingVertical: 30 }}>
        No recipes yet. Tap New Recipe, add saved foods by weight, then weigh the finished dish.
      </Label> : null}
    </View>
  </Phone>;
}

/** A recipe's weighed portion: nutrition for the entered grams of the finished dish. */
export function RecipeDetail({ summary, recipe, quantity, preview, error, onQuantity, onAdd, onBack, onEdit, onClose }: {
  summary: string; recipe: Recipe; quantity: string; preview: { nutrition: Nutrition; portion: Portion } | null; error: string;
  onQuantity: (text: string) => void; onAdd: () => void; onBack: () => void; onEdit: () => void; onClose: () => void;
}) {
  const p = palettes.dark;
  const base = per100(recipe);
  const shown = preview?.nutrition ?? base;
  return <Phone dark header={<LoggerHeader summary={summary} onClose={onClose} />} footer={<LoggerFooter>
    <Row style={{ gap: 8, alignItems: 'flex-end' }}>
      <Field label="Portion" a11y="Portion in grams" value={quantity} onChangeText={onQuantity} suffix="g" placeholder="100"
        keyboardType="decimal-pad" autoFocus error={error || undefined} style={{ flex: 1 }} />
      <Button primary label="Add" onPress={onAdd}>Add</Button>
    </Row>
  </LoggerFooter>}>
    <LoggerBody>
      <Row style={{ gap: 8 }}><Chevron label="Back to recipes" onPress={onBack}>‹</Chevron>
        <View style={{ flex: 1 }}><Label accessibilityRole="header" size={13}>{recipe.name}</Label>
          <Label size={11} muted>Makes {round(recipe.finishedGrams)} g from {round(rawGrams(recipe.ingredients))} g of ingredients</Label></View></Row>
      <Macros values={[`${round(shown.calories)}`, grams(shown.protein), grams(shown.fat), grams(shown.carbs)]} />
      {preview ? <Label size={12} accessibilityLiveRegion="polite">{round(preview.portion.amount)} g: {describe(preview.nutrition)}</Label> : null}
      <Label size={12} muted>Per 100 g: {describe(base)}</Label>
      <Warnings ingredients={recipe.ingredients} />
      <Card style={{ paddingVertical: 4, gap: 0, borderWidth: 1, borderColor: p.border }}>
        {recipe.ingredients.map((i, n) => <IngredientRow key={n} ingredient={i} first={n === 0} />)}
      </Card>
      <Label size={12} muted>{LIMIT} Ingredient values are copies; editing a saved food doesn't change this recipe.</Label>
      <Row><Button hint="Changes future logs only" onPress={onEdit}>Edit Recipe</Button></Row>
    </LoggerBody>
  </Phone>;
}

/** Create or edit a recipe: name, finished weight, and ingredients. Edits apply to future logs only. */
export function RecipeBuilder({ editing, form, ingredients, errors, error, onField, onAddIngredient, onRemove, onSave, onBack }: {
  editing: boolean; form: RecipeForm; ingredients: Ingredient[]; errors: RecipeFormErrors; error: string;
  onField: (key: keyof RecipeForm, text: string) => void; onAddIngredient: () => void; onRemove: (index: number) => void;
  onSave: () => void; onBack: () => void;
}) {
  const p = palettes.light;
  return <Phone title={editing ? 'Edit Recipe' : 'Create Recipe'} onBack={onBack} backLabel="Cancel"
    footer={<View style={{ padding: 18, backgroundColor: p.surface }}><Button primary onPress={onSave}>Save</Button></View>}>
    <View style={{ padding: 18, gap: 20, backgroundColor: p.surface, flexGrow: 1 }}>
      <Label accessibilityRole="header" size={21} weight="600">Build your recipe</Label>
      {editing ? <Label muted size={12}>Changes apply to future logs. Portions you already logged keep their values.</Label> : null}
      <Field label="Recipe Name" a11y="Recipe name" value={form.name} onChangeText={(t) => onField('name', t)} error={errors.name}
        autoFocus={!editing && form.name === '' && ingredients.length === 0} />
      <View style={{ gap: 8 }}>
        <Field label="Total Weight" a11y="Finished weight in grams" value={form.finishedGrams}
          onChangeText={(t) => onField('finishedGrams', t)} suffix="g" placeholder="Enter weight after preparation"
          keyboardType="decimal-pad" error={errors.finishedGrams} />
        <Label muted size={12}>Weigh the whole finished dish. {LIMIT}</Label>
      </View>
      <Row style={{ justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, gap: 6 }}><Label accessibilityRole="header">Ingredients</Label>
          <Label size={12} muted>{ingredients.length === 0 ? 'Saved foods, weighed in grams'
            : `Weight of ingredients is ${round(rawGrams(ingredients))} g`}</Label></View>
        <Button label="Add ingredient" onPress={onAddIngredient}>+</Button>
      </Row>
      {errors.ingredients ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{errors.ingredients}</Label> : null}
      {ingredients.length > 0 ? <View>
        {ingredients.map((i, n) => <IngredientRow key={n} ingredient={i} first={n === 0} onRemove={() => onRemove(n)} />)}
      </View> : null}
      <Warnings ingredients={ingredients} />
      {error ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{error}</Label> : null}
    </View>
  </Phone>;
}

/** Picks a saved food for the recipe, then its amount in grams or servings. The recipe draft waits. */
export function IngredientPicker({ query, foods, food, quantity, unit, error, onQuery, onFood, onQuantity, onUnit, onAdd, onBack }: {
  query: string; foods: Food[]; food: Food | null; quantity: string; unit: 'g' | 'serving'; error: string;
  onQuery: (text: string) => void; onFood: (food: Food) => void; onQuantity: (text: string) => void;
  onUnit: (unit: 'g' | 'serving') => void; onAdd: () => void; onBack: () => void;
}) {
  const p = palettes.light;
  const alert = error ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{error}</Label> : null;
  if (!food) {
    return <Phone title="Add Ingredient" onBack={onBack} backLabel="Back to recipe"
      header={<View style={{ paddingHorizontal: 18, paddingBottom: 12, backgroundColor: p.surface }}>
        <TextInput accessibilityLabel="Search saved foods" value={query} onChangeText={onQuery} placeholder="Search for a food"
          placeholderTextColor={p.muted} autoFocus autoCorrect={false} returnKeyType="search"
          style={{ minHeight: 46, paddingHorizontal: 15, borderRadius: 24, color: p.text, backgroundColor: p.field, fontSize: 14 }} />
      </View>}>
      <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 8, backgroundColor: p.surface, flexGrow: 1 }}>
        {alert}
        {foods.map((f) => <FoodRow key={f.id} food={f} hint="Add this food to the recipe" onPress={() => onFood(f)} />)}
        {foods.length === 0 ? <Label muted style={{ paddingVertical: 30 }}>
          {query.trim() ? `No saved foods match "${query.trim()}".` : 'No saved foods yet. Save the ingredients as foods first.'}
        </Label> : null}
      </View>
    </Phone>;
  }
  const units = food.serving ? ['g', food.serving.name] : null;
  return <Phone title="Add Ingredient" onBack={onBack} backLabel="Back to foods"
    footer={<View style={{ padding: 18, backgroundColor: p.surface }}><Button primary onPress={onAdd}>Add to recipe</Button></View>}>
    <View style={{ padding: 18, gap: 20, backgroundColor: p.surface, flexGrow: 1 }}>
      <View style={{ gap: 6 }}><Label accessibilityRole="header" size={21} weight="600">{food.name}</Label>
        <Label size={12} muted>Per 100 g: {describe(food)}</Label></View>
      <Field label={unit === 'serving' ? `Servings of ${servingText(food)}` : 'Amount'}
        a11y={unit === 'serving' ? 'Number of servings' : 'Amount in grams'} value={quantity} onChangeText={onQuantity}
        suffix={unit === 'serving' ? food.serving?.name : 'g'} placeholder={unit === 'serving' ? '1' : '100'}
        keyboardType="decimal-pad" autoFocus error={error || undefined} />
      {units ? <Segments label="Unit" values={units} selected={unit === 'serving' ? units[1] : units[0]}
        names={{ g: 'Grams', [units[1]]: `Servings of ${servingText(food)}` }}
        onChange={(value) => onUnit(value === 'g' ? 'g' : 'serving')} /> : null}
      <Label size={12} muted>The recipe keeps a copy of these values. Editing the food later won't change it.</Label>
    </View>
  </Phone>;
}
