// The logger's Barcode tab (typed codes; the camera comes in ticket 07) and the provider record review.
// Both share the dark logger sheet with FoodSearch and FoodDetail: ribbon header, one body surface,
// a pinned footer for the primary action, and FoodDetail's title, macro summary, and facts card.
import { ActivityIndicator, TextInput, View } from 'react-native';

import { Button, Label, Macros, palettes, Phone, Row, usePalette } from '../../ui';
import { describe, FoodFacts, FoodRow, FoodTitle, LoggerBody, LoggerFooter, LoggerHeader, round, type LoggerTab } from '../diary/LoggingScreens';
import type { Food } from '../foods/foods';
import { OFF_SOURCE, type Lookup, type Miss, type OffResult, type ProviderFood } from './lookup';

type Outcome = { title: string; text: string; action?: 'retry' | 'key' };

// What each outcome means and how to recover. Creating the food by hand is always offered as well.
const outcomes: Record<Miss['kind'], Outcome> = {
  'not-found': { title: 'No USDA match', text: 'No USDA record has exactly this barcode.' },
  'invalid-nutrition': { title: "USDA's nutrition can't be used",
    text: 'USDA has this barcode, but its record lacks calories or a gram or millilitre basis, or lists conflicting values. Create the food from its label instead.' },
  'missing-key': { title: 'Not in your saved foods', action: 'key',
    text: 'Add your free USDA key in Settings to search USDA too.' },
  'rejected-key': { title: 'USDA rejected your key', action: 'key',
    text: 'Check the key in Settings. Your saved foods still work without it.' },
  timeout: { title: "USDA didn't answer", action: 'retry',
    text: 'There was no reply within 10 seconds. Try again, or create the food from its label.' },
  'rate-limited': { title: "USDA's hourly limit is used up", action: 'retry',
    text: 'Your key has made too many requests this hour. Try again later, or create the food from its label.' },
  offline: { title: "Couldn't reach USDA", action: 'retry',
    text: 'Check your connection and try again. Saved foods work offline.' },
  'bad-response': { title: "USDA's reply couldn't be read", action: 'retry',
    text: 'Try again in a moment, or create the food from its label.' },
};

// Open Food Facts outcomes after it was asked. A failure here never hides the USDA outcome above it.
const offOutcomes: Record<Exclude<OffResult['kind'], 'off'>, Outcome> = {
  'not-found': { title: 'Not in Open Food Facts',
    text: 'Open Food Facts has no product with this barcode either. Create the food from its label; the barcode is filled in.' },
  'invalid-nutrition': { title: "Open Food Facts' nutrition can't be used",
    text: 'Its product lacks a name or label calories per 100 g or 100 ml, or lists them in other units. Create the food from its label instead.' },
  timeout: { title: "Open Food Facts didn't answer", action: 'retry',
    text: 'There was no reply within 10 seconds. Try again, or create the food from its label.' },
  'rate-limited': { title: 'Open Food Facts is busy', action: 'retry',
    text: 'It allows a few lookups a minute. Wait a minute and try again, or create the food from its label.' },
  offline: { title: "Couldn't reach Open Food Facts", action: 'retry',
    text: 'Check your connection and try again. Saved foods work offline.' },
  'bad-response': { title: "Open Food Facts' reply couldn't be read", action: 'retry',
    text: 'It may have sent a format this app does not read. Try again later, or create the food from its label.' },
};

const record = (f: ProviderFood) => `USDA record ${f.source.id.replace('fdc:', '')}${f.published ? `, published ${f.published}` : ''}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Heading({ title, text }: { title: string; text: string }) {
  return <View style={{ gap: 4, paddingBottom: 4 }}>
    <Label accessibilityRole="header">{title}</Label>
    <Label size={12} muted>{text}</Label>
  </View>;
}

function Notice({ outcome }: { outcome: Outcome }) {
  return <View accessibilityRole="alert" style={{ gap: 4 }}>
    <Label accessibilityRole="header">{outcome.title}</Label>
    <Label size={12} muted>{outcome.text}</Label>
  </View>;
}

function Result({ result, looking, onFood, onReview, onRetry, onOff, onKey, onCreate }: {
  result: Lookup | null; looking: boolean; onFood: (food: Food) => void; onReview: (food: ProviderFood) => void;
  onRetry: () => void; onOff: (miss: Miss) => void; onKey: () => void; onCreate: () => void;
}) {
  const p = usePalette();
  if (looking) return <Row style={{ gap: 10, paddingVertical: 24 }}>
    <ActivityIndicator color={p.text} />
    <Label accessibilityLiveRegion="polite" muted style={{ flex: 1 }}>
      {result ? 'Asking Open Food Facts…' : 'Checking saved foods, then USDA and Open Food Facts…'}
    </Label>
  </Row>;
  if (!result || result.kind === 'invalid') return <Heading title="Type a barcode"
    text="Enter the digits printed under the barcode. Your saved foods are checked first, offline. Then USDA FoodData Central, if you've added your key in Settings, and Open Food Facts." />;
  if (result.kind === 'saved') return <View>
    <Heading title="In your saved foods" text="Found on this phone, so nothing was looked up online." />
    {result.foods.map(food => <FoodRow key={food.id} food={food} onPress={() => onFood(food)} />)}
  </View>;
  if (result.kind === 'usda') return <View>
    <Heading title="USDA FoodData Central" text={result.foods.length === 1
      ? 'One record has exactly this barcode. Open it to check the nutrition before saving.'
      : `${result.foods.length} records have exactly this barcode, such as older and newer labels. Compare them and save the one on your package.`} />
    {result.foods.map(food => <FoodRow key={food.source.id} food={food} detail={record(food)}
      hint="Review this record before saving it" onPress={() => onReview(food)} />)}
    {result.invalid > 0 ? <Label size={12} muted style={{ paddingTop: 12 }}>
      {plural(result.invalid, 'more record was', 'more records were')} left out because the nutrition can't be used.
    </Label> : null}
  </View>;
  const usda = outcomes[result.kind];
  const off = result.off;
  if (off?.kind === 'off') return <View>
    <Heading title={OFF_SOURCE} text={`${usda.title}. Open Food Facts has one product with exactly this barcode. Open it to check the nutrition before saving.`} />
    <FoodRow food={off.food} detail={`Open Food Facts product ${off.food.source.id.replace('off:', '')}`}
      hint="Review this product before saving it" onPress={() => onReview(off.food)} />
  </View>;
  const offOutcome = off ? offOutcomes[off.kind] : null;
  // USDA failed or could not be used; asking Open Food Facts is the owner's call, never automatic.
  const askOff = !off && result.kind !== 'not-found' && result.kind !== 'missing-key';
  const retry = usda.action === 'retry' || offOutcome?.action === 'retry';
  return <View style={{ gap: 12 }}>
    <Notice outcome={usda} />
    {offOutcome ? <Notice outcome={offOutcome} /> : null}
    <Row style={{ gap: 8, flexWrap: 'wrap' }}>
      {/* Try again repeats the request that failed: Open Food Facts alone when it was that one. */}
      {retry ? <Button primary onPress={offOutcome?.action === 'retry' ? () => onOff(result) : onRetry}>Try again</Button> : null}
      {askOff ? <Button primary={!retry} onPress={() => onOff(result)}>Try Open Food Facts</Button> : null}
      {usda.action === 'key' ? <Button primary={!retry && !askOff} onPress={onKey}>Open Settings</Button> : null}
      <Button onPress={onCreate}>Create food</Button>
    </Row>
  </View>;
}

/**
 * The Barcode tab: a typed code, saved-food matches, exact USDA matches, an Open Food Facts
 * product, or a recoverable outcome.
 */
export function BarcodeLookup({ summary, code, result, looking, failure, onCode, onLookUp, onOff, onFood, onReview, onKey, onCreate, onClose, onTab }: {
  summary: string; code: string; result: Lookup | null; looking: boolean; failure: string; onCode: (code: string) => void;
  onLookUp: () => void; onOff: (miss: Miss) => void; onFood: (food: Food) => void; onReview: (food: ProviderFood) => void; onKey: () => void;
  onCreate: () => void; onClose: () => void; onTab: (tab: LoggerTab) => void;
}) {
  const p = palettes.dark;
  const error = result?.kind === 'invalid' ? result.error : failure;
  return <Phone dark header={<LoggerHeader active="Barcode" summary={summary} onClose={onClose} onTab={onTab} />}
    // The same pill footer as FoodSearch, so switching tabs never moves the field.
    footer={<View style={{ padding: 12, gap: 8, backgroundColor: p.surface }}>
      {error ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger, paddingHorizontal: 15 }}>{error}</Label> : null}
      <Row style={{ gap: 8 }}>
        <TextInput accessibilityLabel="Barcode digits" value={code} onChangeText={onCode} placeholder="Barcode digits"
          placeholderTextColor={p.muted} autoFocus keyboardType="number-pad" returnKeyType="search" onSubmitEditing={onLookUp}
          style={{ flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 15, borderRadius: 24, color: p.text,
            backgroundColor: p.field, fontSize: 14, borderWidth: 1, borderColor: error ? p.danger : 'transparent' }} />
        <Button primary label="Look up barcode" disabled={looking} onPress={onLookUp}>Look up</Button>
      </Row>
    </View>}>
    <LoggerBody>
      <Result result={result} looking={looking} onFood={onFood} onReview={onReview} onRetry={onLookUp} onOff={onOff} onKey={onKey}
        onCreate={onCreate} />
    </LoggerBody>
  </Phone>;
}

/** A provider record, inspected before anything is saved. Unknown nutrients stay unknown, never 0. */
export function ProviderReview({ summary, food, error, onSave, onBack, onClose }: {
  summary: string; food: ProviderFood; error: string; onSave: () => void; onBack: () => void; onClose: () => void;
}) {
  const p = palettes.dark;
  const unknown = (['protein', 'fat', 'carbs'] as const).filter(key => food[key] === null);
  const value = (n: number | null) => (n === null ? '?' : `${round(n)}`);
  return <Phone dark header={<LoggerHeader summary={summary} onClose={onClose} />} footer={<LoggerFooter>
    <Row style={{ gap: 8 }}>
      <Label size={12} muted style={{ flex: 1 }}>Nothing is saved until you tap Save food.</Label>
      <Button primary hint="Keeps it on this phone for offline logging" onPress={onSave}>Save food</Button>
    </Row>
  </LoggerFooter>}>
    <LoggerBody>
      <FoodTitle food={food} backLabel="Back to barcode results" onBack={onBack} />
      <Macros values={[`${round(food.calories)}`, value(food.protein), value(food.fat), value(food.carbs)]} />
      <Label size={12} muted>Per 100 {food.basis}: {describe(food)}</Label>
      {unknown.length > 0 ? <Label size={12} style={{ color: p.warning }}>
        No usable {unknown.join(' or ')} in the selected nutrition record. It stays unknown in your log, not 0.
      </Label> : null}
      <FoodFacts food={food} published={food.published} saved="Retrieved" />
      {error ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{error}</Label> : null}
    </LoggerBody>
  </Phone>;
}
