import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import BackupSettings from '../backup/BackupSettings';
import {
  archiveFood, insertFood, logPortion, parseFoodForm, searchFoods, updateFood,
  type Food, type FoodForm, type FoodFormErrors,
} from '../foods/foods';
import { loadTargets, parseTargets, saveTargets, type TargetErrors, type Targets } from '../goals/goals';
import { TargetsForm } from '../goals/TargetsForm';
import {
  deleteEntry, insertEntry, listEntries, localDay, parseAmount, parseEntryForm, updateEntry,
  type Entry, type EntryForm, type FormErrors, type NutritionForm, type Unit,
} from './diary';
import { CreateFood, daySummary, FoodDetail, FoodLog, FoodSearch, QuickAdd } from './LoggingScreens';

// The visible screen. Quick add and corrections share `entry`; `edit` returns to `from` on cancel.
type View =
  | { kind: 'log' }
  | { kind: 'entry'; id: number | null; form: EntryForm; portion: Entry['portion'] }
  | { kind: 'search' }
  | { kind: 'food'; food: Food; quantity: string; unit: Unit | 'serving' }
  | { kind: 'edit'; id: number | null; form: FoodForm; from: Food | null }
  | { kind: 'settings' }
  | { kind: 'targets'; form: NutritionForm };

const blankEntry: View = { kind: 'entry', id: null, form: { label: '', calories: '', protein: '', carbs: '', fat: '' }, portion: null };
const toText = (n: number | null) => (n === null ? '' : String(n));
const foodView = (food: Food): View => ({ kind: 'food', food, quantity: '', unit: food.basis });
const blankFood = (name: string): FoodForm => ({
  name, basis: 'g', calories: '', protein: '', carbs: '', fat: '', servingName: '', servingAmount: '', barcode: '',
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
  const [errors, setErrors] = useState<FormErrors & FoodFormErrors & TargetErrors>({});
  const [error, setError] = useState('');
  // Synchronous lock: a second tap can land before React re-renders after the first.
  const writing = useRef(false);

  const reload = useCallback(async () => {
    setEntries(await listEntries(db, day));
    setTargets(await loadTargets(db));
  }, [db, day]);
  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    if (view.kind === 'search') searchFoods(db, query).then(setFoods);
  }, [db, query, view.kind]);

  function go(next: View) {
    setView(next);
    setErrors({});
    setError('');
  }

  // Runs one write at a time; on failure the draft stays open with an alert.
  async function write(action: () => Promise<View>) {
    if (writing.current) return;
    writing.current = true;
    try {
      go(await action());
      await reload();
    } catch {
      setError('Could not save. Your changes are still here; try again.');
    } finally {
      writing.current = false;
    }
  }

  const summary = daySummary(entries);
  const close = () => go({ kind: 'log' });

  if (view.kind === 'entry') {
    const { id, form } = view;
    return <QuickAdd summary={summary} form={form} errors={errors} saveError={error} correcting={id !== null}
      portion={view.portion} onClose={close} onSearch={() => go({ kind: 'search' })}
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
      onQuickAdd={() => go(blankEntry)} onFood={food => go(foodView(food))}
      onNew={() => go({ kind: 'edit', id: null, form: blankFood(query.trim()), from: null })} />;
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
      onEdit={() => go({ kind: 'edit', id: food.id, form: formOf(food), from: food })}
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
    const { id, form, from } = view;
    return <CreateFood editing={id !== null} form={form} errors={errors} error={error}
      onField={(key, value) => {
        setErrors(({ [key]: _, ...rest }) => rest);
        setView({ ...view, form: { ...form, [key]: value } });
      }}
      onBack={() => go(from ? foodView(from) : { kind: 'search' })}
      onSave={() => {
        const result = parseFoodForm(form);
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
    return <BackupSettings onClose={() => {
      close();
      reload();
    }} />;
  }

  return <FoodLog day={day} entries={entries} targets={targets} onDay={setDay} onEntry={e => go(entryView(e))}
    onSearch={() => go({ kind: 'search' })} onQuickAdd={() => go(blankEntry)} onSettings={() => go({ kind: 'settings' })}
    onTargets={() => go(targetsView(targets))} />;
}
