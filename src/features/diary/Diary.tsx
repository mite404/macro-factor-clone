import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';

import BackupSettings from '../backup/BackupSettings';
import {
  archiveFood, insertFood, logPortion, parseFoodForm, searchFoods, updateFood,
  type Food, type FoodForm, type FoodFormErrors,
} from '../foods/foods';
import { BarcodeLookup, ProviderReview } from '../lookup/BarcodeScreens';
import { loadUsdaKey } from '../lookup/key';
import { lookupBarcode, lookupOff, type Lookup, type Miss, type ProviderFood } from '../lookup/lookup';
import { loadTargets, parseTargets, saveTargets, type TargetErrors, type Targets } from '../goals/goals';
import { TargetsForm } from '../goals/TargetsForm';
import { IngredientPicker, RecipeBuilder, RecipeDetail, RecipeList } from '../recipes/RecipeScreens';
import {
  ingredientOf, insertRecipe, listRecipes, logRecipe, parseRecipeForm, updateRecipe,
  type Ingredient, type Recipe, type RecipeForm, type RecipeFormErrors,
} from '../recipes/recipes';
import {
  addDays, copyEntries, deleteEntry, insertEntry, listEntries, localDay, parseAmount, parseEntryForm, updateEntry,
  type Entry, type EntryForm, type FormErrors, type NutritionForm, type Unit,
} from './diary';
import {
  CopyEntries, CreateFood, dayName, daySummary, FoodDetail, FoodLog, FoodSearch, QuickAdd, type LoggerTab,
} from './LoggingScreens';

// A barcode lookup in progress or finished. `result` belongs to `code` as it was when looked up.
// `scanning` shows the camera in place of the result; a scan closes it and looks the code up.
type BarcodeView = { kind: 'barcode'; code: string; result: Lookup | null; looking: boolean; scanning: boolean };
// The ingredient picker lives inside the recipe draft, so choosing a food never loses the draft.
type Picking = { query: string; food: Food | null; quantity: string; unit: 'g' | 'serving' };
type BuildView = { kind: 'build'; id: number | null; form: RecipeForm; ingredients: Ingredient[]; picking: Picking | null; back: View };
// The visible screen. Quick add and corrections share `entry`; `edit` keeps `from`'s brand and
// source and returns to `back` on cancel; `settings` returns to `back`. `copy` selects entries of
// the day shown, by id, to copy to day `to`; `notice` reports the last copy on the log.
type View =
  | { kind: 'log'; notice?: string }
  | { kind: 'copy'; ids: number[]; to: string }
  | { kind: 'entry'; id: number | null; form: EntryForm; portion: Entry['portion'] }
  | { kind: 'search' }
  | BarcodeView
  | { kind: 'review'; food: ProviderFood; back: BarcodeView }
  | { kind: 'food'; food: Food; quantity: string; unit: Unit | 'serving' }
  | { kind: 'edit'; id: number | null; form: FoodForm; from: Food | null; back: View }
  | { kind: 'settings'; back: View }
  | { kind: 'targets'; form: NutritionForm }
  | { kind: 'recipes' }
  | { kind: 'recipe'; recipe: Recipe; quantity: string }
  | BuildView;

const blankEntry: View = { kind: 'entry', id: null, form: { label: '', calories: '', protein: '', carbs: '', fat: '' }, portion: null };
const toText = (n: number | null) => (n === null ? '' : String(n));
const foodView = (food: Food): View => ({ kind: 'food', food, quantity: '', unit: food.basis });
const blankPicking: Picking = { query: '', food: null, quantity: '', unit: 'g' };
const blankBarcode: BarcodeView = { kind: 'barcode', code: '', result: null, looking: false, scanning: false };
const blankFood = (name: string, barcode = ''): FoodForm => ({
  name, basis: 'g', calories: '', protein: '', carbs: '', fat: '', servingName: '', servingAmount: '', barcode,
});
const formOf = (f: Food): FoodForm => ({
  name: f.name, basis: f.basis, calories: String(f.calories), protein: toText(f.protein), carbs: toText(f.carbs),
  fat: toText(f.fat), servingName: f.serving?.name ?? '', servingAmount: toText(f.serving?.amount ?? null), barcode: f.barcode ?? '',
});
const targetsView = (t: Targets): View => ({
  kind: 'targets', form: { calories: toText(t.calories ?? null), protein: toText(t.protein ?? null), carbs: toText(t.carbs ?? null), fat: toText(t.fat ?? null) },
});
const entryView = (e: Entry): View => ({
  kind: 'entry', id: e.id, portion: e.portion,
  form: { label: e.label, calories: String(e.calories), protein: toText(e.protein), carbs: toText(e.carbs), fat: toText(e.fat) },
});

/** Wires the logging screens to the diary and saved foods in the app's SQLite database. */
export default function Diary() {
  const db = useSQLiteContext();
  const [day, setDay] = useState(() => localDay());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [targets, setTargets] = useState<Targets>({});
  const [view, setView] = useState<View>({ kind: 'log' });
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState<Food[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [errors, setErrors] = useState<FormErrors & FoodFormErrors & TargetErrors & RecipeFormErrors>({});
  const [error, setError] = useState('');
  // Synchronous lock: a second tap can land before React re-renders after the first.
  const writing = useRef(false);
  // Mirrors the lock for display, so a running write shows on its button.
  const [busy, setBusy] = useState(false);
  // Bumped by every navigation and lookup, so a late provider reply never lands on another screen or code.
  const lookups = useRef(0);

  // Bumped after every write; a reply for a day or write already superseded never lands.
  const [saved, setSaved] = useState(0);
  useEffect(() => {
    let current = true;
    Promise.all([listEntries(db, day), loadTargets(db)]).then(([list, goals]) => {
      if (!current) return;
      setEntries(list);
      setTargets(goals);
    });
    return () => {
      current = false;
    };
  }, [db, day, saved]);
  const reload = () => setSaved(n => n + 1);
  useEffect(() => {
    if (view.kind === 'search') searchFoods(db, query).then(setFoods);
  }, [db, query, view.kind]);
  const pickQuery = view.kind === 'build' && view.picking ? view.picking.query : null;
  useEffect(() => {
    if (pickQuery !== null) searchFoods(db, pickQuery).then(setFoods);
  }, [db, pickQuery]);
  useEffect(() => {
    if (view.kind === 'recipes') listRecipes(db).then(setRecipes);
  }, [db, view.kind]);

  function go(next: View) {
    lookups.current++;
    setView(next);
    setErrors({});
    setError('');
  }

  // Runs one write at a time; on failure the draft stays open with an alert.
  async function write(action: () => Promise<View>) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    try {
      go(await action());
      reload();
    } catch {
      setError('Could not save. Your changes are still here; try again.');
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  // Looks `code` up from the start, or, given USDA's outcome `after`, asks Open Food Facts alone.
  async function lookUp(code: string, after: Miss | null = null) {
    const id = ++lookups.current;
    setView({ kind: 'barcode', code, result: after, looking: true, scanning: false });
    setError('');
    let result: Lookup | null = after;
    try {
      result = after ? { ...after, off: await lookupOff(code) } : await lookupBarcode(db, code, loadUsdaKey);
    } catch {
      if (lookups.current === id) setError('Could not check your saved foods. Try again.');
    }
    if (lookups.current === id) setView({ kind: 'barcode', code, result, looking: false, scanning: false });
  }

  const summary = daySummary(entries);
  const close = () => go({ kind: 'log' });
  const tab = (name: LoggerTab) => go(name === 'Barcode' ? blankBarcode : name === 'Search' ? { kind: 'search' }
    : name === 'Recipes' ? { kind: 'recipes' } : blankEntry);

  if (view.kind === 'entry') {
    const { id, form } = view;
    return <QuickAdd summary={summary} form={form} errors={errors} saveError={error} correcting={id !== null}
      portion={view.portion} onClose={close} onTab={tab}
      onField={(key, text) => {
        setErrors(({ [key]: _, ...rest }) => rest);
        setView({ ...view, form: { ...form, [key]: text } });
      }}
      onSave={() => {
        const result = parseEntryForm(form, day);
        if ('errors' in result) return setErrors(result.errors);
        write(async () => {
          await (id === null ? insertEntry(db, result.entry) : updateEntry(db, id, result.entry));
          return { kind: 'log' };
        });
      }}
      onDelete={() => id !== null && write(async () => {
        await deleteEntry(db, id);
        return { kind: 'log' };
      })} />;
  }

  if (view.kind === 'search') {
    return <FoodSearch summary={summary} query={query} foods={foods} onQuery={setQuery} onClose={close}
      onTab={tab} onFood={food => go(foodView(food))}
      onNew={() => go({ kind: 'edit', id: null, form: blankFood(query.trim()), from: null, back: { kind: 'search' } })} />;
  }

  if (view.kind === 'barcode') {
    const { code, result, looking, scanning } = view;
    // The code as last looked up, so a draft edited afterwards never fills in the new food.
    const looked = result && result.kind !== 'invalid' ? code : '';
    return <BarcodeLookup summary={summary} code={code} result={result} looking={looking} scanning={scanning} failure={error}
      onClose={close} onTab={tab}
      onCode={text => {
        lookups.current++;
        setError('');
        setView({ ...view, code: text, result: null, looking: false });
      }}
      onScanner={open => setView({ ...view, scanning: open })}
      onScan={scanned => !looking && lookUp(scanned)}
      onLookUp={() => !looking && lookUp(code)} onFood={food => go(foodView(food))}
      onOff={miss => !looking && lookUp(code, miss)}
      onReview={food => go({ kind: 'review', food, back: view })}
      onKey={() => go({ kind: 'settings', back: { ...view, result: null } })}
      onCreate={() => go({ kind: 'edit', id: null, form: blankFood('', looked), from: null, back: view })} />;
  }

  if (view.kind === 'review') {
    const { food, back } = view;
    return <ProviderReview summary={summary} food={food} error={error} onClose={close} onBack={() => go(back)}
      onSave={() => write(async () => {
        const id = await insertFood(db, food, food);
        return foodView({ ...food, id });
      })} />;
  }

  if (view.kind === 'food') {
    const { food, quantity, unit } = view;
    const amount = parseAmount(quantity);
    const preview = amount ? logPortion(food, amount, unit) : null;
    return <FoodDetail summary={summary} food={food} quantity={quantity} unit={unit} error={error}
      preview={preview && 'portion' in preview ? preview : null}
      onQuantity={text => {
        setError('');
        setView({ ...view, quantity: text });
      }}
      onUnit={next => setView({ ...view, unit: next })}
      onBack={() => go({ kind: 'search' })} onClose={close}
      onEdit={() => go({ kind: 'edit', id: food.id, form: formOf(food), from: food, back: view })}
      onAdd={() => {
        const checked = logPortion(food, amount ?? NaN, unit);
        if ('error' in checked) return setError(checked.error);
        write(async () => {
          await insertEntry(db, { day, label: food.name, ...checked.nutrition }, checked.portion);
          return { kind: 'log' };
        });
      }} />;
  }

  if (view.kind === 'edit') {
    const { id, form, from, back } = view;
    return <CreateFood editing={id !== null} form={form} errors={errors} error={error}
      onField={(key, value) => {
        setErrors(({ [key]: _, ...rest }) => rest);
        setView({ ...view, form: { ...form, [key]: value } });
      }}
      onBack={() => go(back)}
      onSave={() => {
        const result = parseFoodForm(form, from?.barcode ?? null);
        if ('errors' in result) return setErrors(result.errors);
        write(async () => {
          const savedId = id ?? (await insertFood(db, result.food));
          if (id !== null) await updateFood(db, id, result.food);
          return foodView({ brand: null, source: null, ...from, ...result.food, id: savedId });
        });
      }}
      onArchive={() => id !== null && write(async () => {
        await archiveFood(db, id);
        return { kind: 'search' };
      })} />;
  }

  if (view.kind === 'recipes') {
    return <RecipeList summary={summary} recipes={recipes} onClose={close} onTab={tab}
      onRecipe={recipe => go({ kind: 'recipe', recipe, quantity: '' })}
      onNew={() => go({ kind: 'build', id: null, form: { name: '', finishedGrams: '' }, ingredients: [], picking: null, back: view })} />;
  }

  if (view.kind === 'recipe') {
    const { recipe, quantity } = view;
    const amount = parseAmount(quantity);
    const preview = amount ? logRecipe(recipe, amount) : null;
    return <RecipeDetail summary={summary} recipe={recipe} quantity={quantity} error={error}
      preview={preview && 'portion' in preview ? preview : null}
      onQuantity={text => {
        setError('');
        setView({ ...view, quantity: text });
      }}
      onBack={() => go({ kind: 'recipes' })} onClose={close}
      onEdit={() => go({ kind: 'build', id: recipe.id, form: { name: recipe.name, finishedGrams: String(recipe.finishedGrams) },
        ingredients: recipe.ingredients, picking: null, back: view })}
      onAdd={() => {
        const checked = logRecipe(recipe, amount ?? NaN);
        if ('error' in checked) return setError(checked.error);
        write(async () => {
          await insertEntry(db, { day, label: recipe.name, ...checked.nutrition }, checked.portion);
          return { kind: 'log' };
        });
      }} />;
  }

  if (view.kind === 'build' && view.picking) {
    const picking = view.picking;
    const pick = (next: Partial<Picking>) => {
      setError('');
      setView({ ...view, picking: { ...picking, ...next } });
    };
    return <IngredientPicker query={picking.query} foods={foods} food={picking.food} quantity={picking.quantity}
      unit={picking.unit} error={error} onQuery={q => pick({ query: q })}
      onFood={food => {
        // Rejects a per-100 ml food before asking for its amount.
        const blocked = ingredientOf(food, 1, 'g');
        if ('error' in blocked) return setError(blocked.error);
        pick({ food, quantity: '', unit: 'g' });
      }}
      onQuantity={q => pick({ quantity: q })} onUnit={unit => pick({ unit })}
      onBack={() => (picking.food ? pick({ food: null }) : go({ ...view, picking: null }))}
      onAdd={() => {
        const checked = ingredientOf(picking.food!, parseAmount(picking.quantity) ?? NaN, picking.unit);
        if ('error' in checked) return setError(checked.error);
        setErrors(({ ingredients: _, ...rest }) => rest);
        setError('');
        setView({ ...view, ingredients: [...view.ingredients, checked.ingredient], picking: null });
      }} />;
  }

  if (view.kind === 'build') {
    const { id, form, ingredients, back } = view;
    return <RecipeBuilder editing={id !== null} form={form} ingredients={ingredients} errors={errors} error={error}
      onField={(key, text) => {
        setErrors(({ [key]: _, ...rest }) => rest);
        setView({ ...view, form: { ...form, [key]: text } });
      }}
      onAddIngredient={() => {
        setError('');
        setView({ ...view, picking: blankPicking });
      }}
      onRemove={index => setView({ ...view, ingredients: ingredients.filter((_, i) => i !== index) })}
      onBack={() => go(back)}
      onSave={() => {
        const result = parseRecipeForm(form, ingredients);
        if ('errors' in result) return setErrors(result.errors);
        write(async () => {
          const savedId = id ?? (await insertRecipe(db, result.recipe));
          if (id !== null) await updateRecipe(db, id, result.recipe);
          return { kind: 'recipe', recipe: { ...result.recipe, id: savedId }, quantity: '' };
        });
      }} />;
  }

  if (view.kind === 'targets') {
    const { form } = view;
    return <TargetsForm form={form} errors={errors} error={error} onBack={close}
      onField={(key, text) => {
        setErrors(({ [key]: _, ...rest }) => rest);
        setView({ ...view, form: { ...form, [key]: text } });
      }}
      onSave={() => {
        const result = parseTargets(form);
        if ('errors' in result) return setErrors(result.errors);
        write(async () => {
          await saveTargets(db, result.targets);
          return { kind: 'log' };
        });
      }} />;
  }

  if (view.kind === 'settings') {
    // A restore may have replaced every entry, so the log reloads on the way back.
    const { back } = view;
    return <BackupSettings backLabel={back.kind === 'log' ? 'Back to food log' : 'Back to barcode lookup'} onClose={() => {
      go(back);
      reload();
    }} />;
  }

  if (view.kind === 'copy') {
    const { ids, to } = view;
    return <CopyEntries day={day} entries={entries} ids={ids} to={to} error={error} copying={busy} onBack={close}
      onToggle={id => setView({ ...view, ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] })}
      onTo={next => setView({ ...view, to: next })}
      onCopy={() => write(async () => {
        await copyEntries(db, ids, to);
        setDay(to);
        return { kind: 'log', notice: `Copied ${ids.length} ${ids.length === 1 ? 'entry' : 'entries'} to ${dayName(to)}.` };
      })} />;
  }

  return <FoodLog day={day} entries={entries} targets={targets} notice={view.notice} onEntry={e => go(entryView(e))}
    onDay={next => {
      setDay(next);
      setView({ kind: 'log' });
    }}
    onCopy={() => go({ kind: 'copy', ids: [], to: day === localDay() ? addDays(day, 1) : localDay() })}
    onSearch={() => go({ kind: 'search' })} onBarcode={() => go(blankBarcode)} onQuickAdd={() => go(blankEntry)}
    onSettings={() => go({ kind: 'settings', back: { kind: 'log' } })}
    onTargets={() => go(targetsView(targets))} />;
}
