// The logger's Barcode tab (typed codes; the camera comes in ticket 07) and the USDA record review.
// Both follow the logger they open from: FoodSearch's dark ribbon, footer field, and result rows, and
// FoodDetail's light name, macro summary, and per-100 line.
import { ActivityIndicator, TextInput, View } from 'react-native';

import { Button, Card, Label, Macros, palettes, Phone, Row, usePalette } from '../../ui';
import { Chevron, describe, FoodRow, LoggerHeader, round, servingText, type LoggerTab } from '../diary/LoggingScreens';
import type { Food } from '../foods/foods';
import type { Lookup, UsdaFood } from './lookup';

type Outcome = Exclude<Lookup['kind'], 'invalid' | 'saved' | 'usda'>;

// What each outcome means and how to recover. Creating the food by hand is always offered as well.
const outcomes: Record<Outcome, { title: string; text: string; action?: 'retry' | 'key' }> = {
  'not-found': { title: 'No USDA match',
    text: 'No USDA record has exactly this barcode. Create the food from its label; the barcode is filled in.' },
  'invalid-nutrition': { title: "USDA's nutrition can't be used",
    text: 'USDA has this barcode, but its record lacks calories or a gram or millilitre basis, or lists conflicting values. Create the food from its label instead.' },
  'missing-key': { title: 'Not in your saved foods', action: 'key',
    text: 'Add your free USDA key in Settings to look it up online, or create the food from its label.' },
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

const record = (f: UsdaFood) => `USDA record ${f.source.id.replace('fdc:', '')}${f.published ? `, published ${f.published}` : ''}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Heading({ title, text }: { title: string; text: string }) {
  return <View style={{ gap: 4, paddingBottom: 4 }}>
    <Label accessibilityRole="header">{title}</Label>
    <Label size={12} muted>{text}</Label>
  </View>;
}

function Result({ result, looking, onFood, onUsda, onRetry, onKey, onCreate }: {
  result: Lookup | null; looking: boolean; onFood: (food: Food) => void; onUsda: (food: UsdaFood) => void;
  onRetry: () => void; onKey: () => void; onCreate: () => void;
}) {
  const p = usePalette();
  if (looking) return <Row style={{ gap: 10, paddingVertical: 24 }}>
    <ActivityIndicator color={p.text} />
    <Label accessibilityLiveRegion="polite" muted>Checking saved foods, then USDA…</Label>
  </Row>;
  if (!result || result.kind === 'invalid') return <Heading title="Type a barcode"
    text="Enter the digits printed under the barcode. Your saved foods are checked first, offline. Then USDA FoodData Central, if you've added your key in Settings." />;
  if (result.kind === 'saved') return <View>
    <Heading title="In your saved foods" text="Found on this phone, so nothing was sent to USDA." />
    {result.foods.map(food => <FoodRow key={food.id} food={food} onPress={() => onFood(food)} />)}
  </View>;
  if (result.kind === 'usda') return <View>
    <Heading title="USDA FoodData Central" text={result.foods.length === 1
      ? 'One record has exactly this barcode. Open it to check the nutrition before saving.'
      : `${result.foods.length} records have exactly this barcode, such as older and newer labels. Compare them and save the one on your package.`} />
    {result.foods.map(food => <FoodRow key={food.source.id} food={food} detail={record(food)}
      hint="Review this record before saving it" onPress={() => onUsda(food)} />)}
    {result.invalid > 0 ? <Label size={12} muted style={{ paddingTop: 12 }}>
      {plural(result.invalid, 'more record was', 'more records were')} left out because the nutrition can't be used.
    </Label> : null}
  </View>;
  const outcome = outcomes[result.kind];
  return <View style={{ gap: 12 }}>
    <View accessibilityRole="alert" style={{ gap: 4 }}>
      <Label accessibilityRole="header">{outcome.title}</Label>
      <Label size={12} muted>{outcome.text}</Label>
    </View>
    <Row style={{ gap: 8, flexWrap: 'wrap' }}>
      {outcome.action === 'retry' ? <Button primary onPress={onRetry}>Try again</Button> : null}
      {outcome.action === 'key' ? <Button primary onPress={onKey}>Open Settings</Button> : null}
      <Button onPress={onCreate}>Create food</Button>
    </Row>
  </View>;
}

/** The Barcode tab: a typed code, saved-food matches, exact USDA matches, or a recoverable outcome. */
export function BarcodeLookup({ summary, code, result, looking, failure, onCode, onLookUp, onFood, onUsda, onKey, onCreate, onClose, onTab }: {
  summary: string; code: string; result: Lookup | null; looking: boolean; failure: string; onCode: (code: string) => void;
  onLookUp: () => void; onFood: (food: Food) => void; onUsda: (food: UsdaFood) => void; onKey: () => void;
  onCreate: () => void; onClose: () => void; onTab: (tab: LoggerTab) => void;
}) {
  const p = palettes.dark;
  const error = result?.kind === 'invalid' ? result.error : failure;
  return <Phone dark header={<LoggerHeader active="Barcode" summary={summary} onClose={onClose} onTab={onTab} />}
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
    <View style={{ padding: 16, backgroundColor: p.surface, flexGrow: 1 }}>
      <Result result={result} looking={looking} onFood={onFood} onUsda={onUsda} onRetry={onLookUp} onKey={onKey} onCreate={onCreate} />
    </View>
  </Phone>;
}

// One labelled value in the provenance card, divided like the targets card rows.
function Fact({ name, value, first = false }: { name: string; value: string; first?: boolean }) {
  const p = usePalette();
  return <Row style={{ gap: 12, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderColor: p.border }}>
    <Label size={12} muted style={{ flex: 1 }}>{name}</Label>
    <Label size={12} style={{ flex: 2, textAlign: 'right' }}>{value}</Label>
  </Row>;
}

/** A USDA record, inspected before anything is saved. Unknown nutrients stay unknown, never 0. */
export function UsdaReview({ summary, food, error, onSave, onBack, onClose }: {
  summary: string; food: UsdaFood; error: string; onSave: () => void; onBack: () => void; onClose: () => void;
}) {
  const p = palettes.light;
  const unknown = (['protein', 'fat', 'carbs'] as const).filter(key => food[key] === null);
  const value = (n: number | null) => (n === null ? '?' : `${round(n)}`);
  return <Phone header={<LoggerHeader summary={summary} onClose={onClose} />} footer={<View style={{ padding: 10, gap: 6 }}>
    <Label size={12} muted style={{ paddingHorizontal: 8 }}>Nothing is saved until you tap Save food.</Label>
    <Row style={{ justifyContent: 'flex-end' }}>
      <Button primary hint="Keeps it on this phone for offline logging" onPress={onSave}>Save food</Button>
    </Row>
  </View>}>
    <View style={{ padding: 18, gap: 16, backgroundColor: p.surface }}>
      <Row style={{ gap: 8 }}><Chevron label="Back to barcode results" onPress={onBack}>‹</Chevron>
        <View style={{ flex: 1 }}><Label accessibilityRole="header" size={13}>{food.name}</Label>
          {food.brand ? <Label size={11} muted>{food.brand}</Label> : null}</View></Row>
      <Macros values={[`${round(food.calories)}`, value(food.protein), value(food.fat), value(food.carbs)]} />
      <Label size={12} muted>Per 100 {food.basis}: {describe(food)}</Label>
      {unknown.length > 0 ? <Label size={12} style={{ color: p.warning }}>
        USDA lists no {unknown.join(' or ')}. It stays unknown in your log, not 0.
      </Label> : null}
      <Card style={{ paddingVertical: 4, gap: 0, borderWidth: 1, borderColor: p.border }}>
        <Fact first name="Barcode" value={food.barcode!} />
        <Fact name="Serving" value={food.serving ? servingText(food) : 'None listed'} />
        <Fact name="Source" value={food.source.name} />
        <Fact name="Record" value={record(food).replace('USDA record ', '')} />
        <Fact name="Retrieved" value={food.source.retrievedOn} />
      </Card>
      {error ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{error}</Label> : null}
    </View>
  </Phone>;
}
