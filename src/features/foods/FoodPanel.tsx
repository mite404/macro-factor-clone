import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { Button, colors, ui } from '../../ui';
import { insertEntry, parseAmount, type Nutrition, type Unit } from '../diary/diary';
import {
  archiveFood,
  insertFood,
  logPortion,
  parseFoodForm,
  searchFoods,
  updateFood,
  type Food,
  type FoodForm,
  type FoodFormErrors,
} from './foods';

// search → log a portion; search or log → create/edit a food → log it.
type Step =
  | { kind: 'search' }
  | { kind: 'edit'; id: number | null; form: FoodForm; from: Food | null }
  | { kind: 'log'; food: Food; quantity: string; unit: Unit | 'serving' };

const round = (n: number) => Math.round(n * 10) / 10;
const grams = (n: number | null) => (n === null ? '?' : `${round(n)}`);
const toText = (n: number | null) => (n === null ? '' : String(n));
const describe = (n: Nutrition) => `${round(n.calories)} kcal · P ${grams(n.protein)} · C ${grams(n.carbs)} · F ${grams(n.fat)} g`;
const servingText = (f: Food) => (f.serving ? `${f.serving.name} (${round(f.serving.amount)} ${f.basis})` : '');

const blankFood = (name = ''): FoodForm => ({
  name,
  basis: 'g',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  servingName: '',
  servingAmount: '',
  barcode: '',
});
const formOf = (f: Food): FoodForm => ({
  name: f.name,
  basis: f.basis,
  calories: String(f.calories),
  protein: toText(f.protein),
  carbs: toText(f.carbs),
  fat: toText(f.fat),
  servingName: f.serving?.name ?? '',
  servingAmount: toText(f.serving?.amount ?? null),
  barcode: f.barcode ?? '',
});
const logView = (food: Food): Step => ({ kind: 'log', food, quantity: '', unit: food.basis });

function Field(props: {
  label: string;
  a11y?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
}) {
  return (
    <View>
      <Text style={ui.label}>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.a11y ?? props.label}
        style={[ui.input, props.error !== undefined && ui.inputError]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={props.keyboardType}
        autoFocus={props.autoFocus}
      />
      {props.error !== undefined && (
        <Text accessibilityRole="alert" style={ui.error}>
          {props.error}
        </Text>
      )}
    </View>
  );
}

/** Finds a saved food, creates or edits one, and logs a measured portion of it to `day`. */
export default function FoodPanel(props: { day: string; onClose: () => void }) {
  const db = useSQLiteContext();
  const [view, setView] = useState<Step>({ kind: 'search' });
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState<Food[]>([]);
  const [errors, setErrors] = useState<FoodFormErrors>({});
  const [error, setError] = useState('');
  // Synchronous lock: a second tap can land before React re-renders after the first.
  const writing = useRef(false);

  useEffect(() => {
    if (view.kind === 'search') searchFoods(db, query).then(setFoods);
  }, [db, query, view.kind]);

  function go(next: Step) {
    setView(next);
    setErrors({});
    setError('');
  }

  async function write(action: () => Promise<void>) {
    if (writing.current) return;
    writing.current = true;
    try {
      await action();
    } catch {
      setError('Could not save. Your changes are still here; try again.');
    } finally {
      writing.current = false;
    }
  }

  if (view.kind === 'search') {
    return (
      <View style={ui.card}>
        <View style={ui.formHeader}>
          <Button label="Cancel" onPress={props.onClose} />
          <Text accessibilityRole="header" style={ui.sectionTitle}>
            Log food
          </Text>
          <Button label="New" a11y="New food" onPress={() => go({ kind: 'edit', id: null, form: blankFood(query.trim()), from: null })} />
        </View>
        <TextInput
          accessibilityLabel="Search saved foods"
          style={ui.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search saved foods"
          placeholderTextColor={colors.muted}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
        {foods.length === 0 ? (
          <Text style={[ui.muted, { paddingVertical: 12 }]}>
            {query.trim() === ''
              ? 'No saved foods yet. Tap New to save one with its nutrition per 100 g or 100 ml.'
              : `No saved foods match "${query.trim()}". Tap New to create it.`}
          </Text>
        ) : (
          foods.map((f, i) => (
            <Pressable
              key={f.id}
              accessibilityRole="button"
              accessibilityLabel={`${f.name}, ${round(f.calories)} kilocalories per 100 ${f.basis}`}
              accessibilityHint="Log a portion of this food"
              onPress={() => go(logView(f))}
              style={({ pressed }) => [{ minHeight: 44, paddingVertical: 8 }, i > 0 && ui.divider, pressed && ui.pressed]}
            >
              <Text style={ui.text}>{f.name}</Text>
              <Text style={ui.muted}>
                {round(f.calories)} kcal per 100 {f.basis}
                {f.serving ? ` · ${servingText(f)}` : ''}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    );
  }

  if (view.kind === 'log') {
    const { food, quantity, unit } = view;
    const amount = parseAmount(quantity);
    const result = amount ? logPortion(food, amount, unit) : null;
    const log = () => {
      const checked = logPortion(food, amount ?? NaN, unit);
      if ('error' in checked) return setError(checked.error);
      write(async () => {
        await insertEntry(db, { day: props.day, label: food.name, ...checked.nutrition }, checked.portion);
        props.onClose();
      });
    };
    return (
      <View style={ui.card}>
        <View style={ui.formHeader}>
          <Button label="‹ Foods" a11y="Back to foods" onPress={() => go({ kind: 'search' })} />
          <Text accessibilityRole="header" style={ui.sectionTitle} numberOfLines={2}>
            {food.name}
          </Text>
          <Button label="Log" tone="primary" onPress={log} />
        </View>
        <Text style={ui.muted}>
          Per 100 {food.basis}: {describe(food)}
        </Text>
        <Field
          label={unit === 'serving' ? `Servings of ${servingText(food)}` : `Amount (${food.basis})`}
          a11y={unit === 'serving' ? 'Number of servings' : `Amount in ${food.basis === 'g' ? 'grams' : 'millilitres'}`}
          value={quantity}
          onChangeText={(text) => {
            setError('');
            setView({ ...view, quantity: text });
          }}
          keyboardType="decimal-pad"
          placeholder={unit === 'serving' ? '1' : '100'}
          autoFocus
        />
        {food.serving && (
          <View style={ui.wrapRow} accessibilityRole="radiogroup" accessibilityLabel="Unit">
            <Button label={food.basis} a11y={food.basis === 'g' ? 'Grams' : 'Millilitres'} selected={unit !== 'serving'} onPress={() => setView({ ...view, unit: food.basis })} />
            <Button label={food.serving.name} a11y={`Servings of ${servingText(food)}`} selected={unit === 'serving'} onPress={() => setView({ ...view, unit: 'serving' })} />
          </View>
        )}
        {result && 'portion' in result && (
          <Text style={ui.text} accessibilityLiveRegion="polite">
            {round(result.portion.amount)} {result.portion.unit}: {describe(result.nutrition)}
          </Text>
        )}
        {error !== '' && (
          <Text accessibilityRole="alert" style={ui.error}>
            {error}
          </Text>
        )}
        <Button label="Edit food" hint="Changes future logs only" onPress={() => go({ kind: 'edit', id: food.id, form: formOf(food), from: food })} />
      </View>
    );
  }

  const { id, form, from } = view;
  const unitWord = form.basis === 'g' ? 'grams' : 'millilitres';
  const setField = (key: keyof FoodForm) => (text: string) => setView({ ...view, form: { ...form, [key]: text } });
  const save = () => {
    const result = parseFoodForm(form);
    if ('errors' in result) return setErrors(result.errors);
    write(async () => {
      const savedId = id ?? (await insertFood(db, result.food));
      if (id !== null) await updateFood(db, id, result.food);
      go(logView({ ...result.food, id: savedId }));
    });
  };
  return (
    <View style={ui.card}>
      <View style={ui.formHeader}>
        <Button label="Cancel" onPress={() => go(from ? logView(from) : { kind: 'search' })} />
        <Text accessibilityRole="header" style={ui.sectionTitle}>
          {id === null ? 'New food' : 'Edit food'}
        </Text>
        <Button label="Save" tone="primary" onPress={save} />
      </View>
      {id !== null && <Text style={ui.muted}>Changes apply to future logs. Past diary entries keep their values.</Text>}
      <Field label="Name" value={form.name} onChangeText={setField('name')} error={errors.name} autoFocus={id === null && form.name === ''} />
      <Text style={ui.label}>Nutrition is per</Text>
      <View style={ui.wrapRow} accessibilityRole="radiogroup" accessibilityLabel="Nutrition is per">
        <Button label="100 g" a11y="100 grams" selected={form.basis === 'g'} onPress={() => setView({ ...view, form: { ...form, basis: 'g' } })} />
        <Button label="100 ml" a11y="100 millilitres" selected={form.basis === 'ml'} onPress={() => setView({ ...view, form: { ...form, basis: 'ml' } })} />
      </View>
      <Field label={`Calories (kcal per 100 ${form.basis})`} a11y={`Calories per 100 ${unitWord}`} value={form.calories} onChangeText={setField('calories')} error={errors.calories} keyboardType="decimal-pad" placeholder="Required" />
      {(['protein', 'carbs', 'fat'] as const).map((key) => (
        <Field
          key={key}
          label={`${key[0].toUpperCase()}${key.slice(1)} (g per 100 ${form.basis}), optional`}
          a11y={`${key} in grams per 100 ${unitWord}`}
          value={form[key]}
          onChangeText={setField(key)}
          error={errors[key]}
          keyboardType="decimal-pad"
          placeholder="Unknown"
        />
      ))}
      <Field label="Serving name, optional" value={form.servingName} onChangeText={setField('servingName')} error={errors.servingName} placeholder="cup, slice, bottle" />
      <Field label={`Serving amount (${form.basis})`} a11y={`Serving amount in ${unitWord}`} value={form.servingAmount} onChangeText={setField('servingAmount')} error={errors.servingAmount} keyboardType="decimal-pad" placeholder={`Measured in ${form.basis}`} />
      <Field label="Barcode, optional" value={form.barcode} onChangeText={setField('barcode')} error={errors.barcode} keyboardType="number-pad" />
      {error !== '' && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      {id !== null && (
        <Button
          label="Archive food"
          tone="danger"
          hint="Hides it from search. Diary entries stay."
          onPress={() =>
            write(async () => {
              await archiveFood(db, id);
              go({ kind: 'search' });
            })
          }
        />
      )}
    </View>
  );
}
