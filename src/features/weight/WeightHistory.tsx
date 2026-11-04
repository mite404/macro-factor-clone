// The history follows the dark "Weight Trend" reference (storybook/AnalyticsScreens.tsx Trend):
// average and range above a dashed-grid chart, unit segments, then the data. The weigh-in form
// follows TargetsForm: title bar with Cancel, a heading, a labelled field, and a pinned Save.
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, colors, Field, Label, palettes, Phone, Row, Segments, Sparkline, usePalette } from '../../ui';
import { addDays, localDay } from '../diary/diary';
import { Chevron, formatDay } from '../diary/LoggingScreens';
import {
  deleteWeight, formatWeight, fromKg, insertWeight, listWeights, loadWeightUnit, parseWeight, saveWeightUnit, trend,
  updateWeight, WINDOW_DAYS, type Trend, type Weight, type WeightUnit,
} from './weight';

// `prefill` is the text the form opened with, so saving an untouched edit keeps the stored kg exactly.
type Screen =
  | { kind: 'list' }
  | { kind: 'form'; day: string; text: string; editing: boolean; prefill: { text: string; unit: WeightUnit } | null };

const UNITS = ['kg', 'lb'] as const;
const UNIT_NAMES = { kg: 'Kilograms', lb: 'Pounds' };
const CHART_DAYS = 30;
const DESCRIPTIVE = `The ${WINDOW_DAYS}-day average is descriptive smoothing: each day averages your weigh-ins from that day and the six `
  + 'before it. Days without a weigh-in are left out, not counted as zero. It is not a prediction, a target, or advice.';

const short = (day: string) => formatDay(day, { month: 'short', day: 'numeric' });
const dated = (day: string) => formatDay(day, { month: 'short', day: 'numeric', year: 'numeric' });
const long = (day: string) => formatDay(day, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const samples = (n: number) => `${n} weigh-in${n === 1 ? '' : 's'}`;
const number = (kg: number, unit: WeightUnit) => formatWeight(kg, unit).split(' ')[0];

// The last CHART_DAYS calendar days up to the latest weigh-in, scaled 0-1; null where a day has none.
function chartSeries(weights: Weight[], points: Trend[], unit: WeightUnit) {
  const last = weights.at(-1)!.day;
  const days = Array.from({ length: CHART_DAYS }, (_, i) => addDays(last, i + 1 - CHART_DAYS));
  const scale = new Map(weights.map((w) => [w.day, fromKg(w.kg, unit)]));
  const smooth = new Map(points.map((t) => [t.day, fromKg(t.kg, unit)]));
  const shown = days.flatMap((d) => [scale.get(d), smooth.get(d)]).filter((v) => v !== undefined);
  // Whole-unit gridlines an even number of units apart, so all three labels stay short at large text.
  const lo = Math.floor(Math.min(...shown));
  const span = Math.max(2, Math.ceil(Math.ceil(Math.max(...shown) - lo) / 2) * 2);
  const at = (v: number | undefined) => (v === undefined ? null : (v - lo) / span);
  return {
    days, scale: days.map((d) => at(scale.get(d))), smooth: days.map((d) => at(smooth.get(d))),
    grid: [lo + span, lo + span / 2, lo].map(String),
    count: days.filter((d) => scale.has(d)).length,
  };
}

function WeightChart({ weights, points, unit }: { weights: Weight[]; points: Trend[]; unit: WeightUnit }) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const { days, scale, smooth, grid, count } = chartSeries(weights, points, unit);
  const plot = Math.max(width - 52, 0);
  return <View style={{ gap: 6 }}>
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: 200 }}>
      {/* A zero-height row centres each label on its line, at the y Sparkline gives 1, 0.5, and 0. */}
      {grid.map((value, n) => <Row key={n} style={{ position: 'absolute', top: 5 + n * 90, left: 0, right: 0, height: 0, gap: 8 }}>
        <View style={{ flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: p.border }} />
        <Label size={11} muted style={{ width: 44 }}>{value}</Label>
      </Row>)}
      {plot > 0 ? <>
        <View style={{ position: 'absolute', top: 0, left: 0 }}>
          <Sparkline values={scale} color={p.muted} width={plot} height={190}
            label={`Chart of ${samples(count)} from ${long(days[0])} to ${long(days.at(-1)!)}, in ${UNIT_NAMES[unit].toLowerCase()}. `
              + 'The history below lists every value.'} />
        </View>
        <View style={{ position: 'absolute', top: 0, left: 0 }}>
          <Sparkline values={smooth} color={colors.weight} width={plot} height={190} dots={false}
            label={`${WINDOW_DAYS}-day average line`} />
        </View>
      </> : null}
    </View>
    <Row style={{ justifyContent: 'space-between', paddingRight: 52 }}>
      <Label size={10} muted>{short(days[0])}</Label><Label size={10} muted>{short(days.at(-1)!)}</Label>
    </Row>
  </View>;
}

function HistoryBody({ weights, unit, onUnit, onWeight }: {
  weights: Weight[]; unit: WeightUnit; onUnit: (unit: WeightUnit) => void; onWeight: (w: Weight) => void;
}) {
  const p = usePalette();
  const points = trend(weights);
  const byDay = new Map(points.map((t) => [t.day, t]));
  const latest = points.at(-1);
  return <>
    <View style={{ backgroundColor: p.surface, padding: 18, gap: 12 }}>
      {latest ? <>
        <Row style={{ gap: 32, flexWrap: 'wrap', rowGap: 8 }}>
          <View><Label size={12} muted>{WINDOW_DAYS}-day average</Label>
            <Label size={28}>{number(latest.kg, unit)}<Label size={12} muted> {unit}</Label></Label></View>
          <View><Label size={12} muted>Latest weigh-in</Label>
            <Label size={25} weight="600">{number(weights.at(-1)!.kg, unit)}<Label size={12} muted> {unit}</Label></Label></View>
        </Row>
        <Label>{`${samples(latest.samples)} · ${short(addDays(latest.day, 1 - WINDOW_DAYS))} – ${dated(latest.day)}`}</Label>
        <WeightChart weights={weights} points={points} unit={unit} />
      </> : <View style={{ gap: 6, paddingVertical: 24 }}>
        <Label size={20} weight="600">No weigh-ins yet</Label>
        <Label muted>Log a weigh-in to start your history. A {WINDOW_DAYS}-day average appears with your first one.</Label>
      </View>}
      <Segments label="Weight unit" values={UNITS} names={UNIT_NAMES} selected={unit} onChange={(u) => onUnit(u as WeightUnit)} />
    </View>
    <View style={{ padding: 16, gap: 18 }}>
      <Card style={{ gap: 8 }}>
        {latest ? <Row style={{ gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Label size={12}><Label size={12} muted>○</Label> Weigh-in</Label>
          <Label size={12}><Label size={12} style={{ color: colors.weight }}>━</Label> {WINDOW_DAYS}-day average</Label>
        </Row> : null}
        <Label size={12} muted>{DESCRIPTIVE}</Label>
      </Card>
      {weights.length > 0 ? <>
        <Label accessibilityRole="header" size={20} weight="600">History</Label>
        <Card style={{ paddingVertical: 4, gap: 0 }}>
          {/* ponytail: renders every row; switch to FlatList if years of daily weigh-ins scroll slowly. */}
          {[...weights].reverse().map((w, i) => {
            const t = byDay.get(w.day)!;
            return <Pressable key={w.day} accessibilityRole="button" onPress={() => onWeight(w)}
              accessibilityLabel={`${long(w.day)}, ${formatWeight(w.kg, unit)}, ${WINDOW_DAYS}-day average ${formatWeight(t.kg, unit)} from ${samples(t.samples)}`}
              accessibilityHint="Edit or delete this weigh-in"
              style={({ pressed }) => [{ paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderColor: p.border }, pressed && { opacity: 0.5 }]}>
              <Row style={{ gap: 12 }}>
                <Label size={13} style={{ flex: 1 }}>{long(w.day)}</Label>
                <Label weight="500">{formatWeight(w.kg, unit)}</Label><Label>✎</Label>
              </Row>
              <Label size={11} muted>{`avg ${formatWeight(t.kg, unit)} · ${samples(t.samples)}`}</Label>
            </Pressable>;
          })}
        </Card>
      </> : null}
    </View>
  </>;
}

function WeighInForm({ screen, existing, unit, error, saveError, onDay, onText, onUnit, onSave, onDelete, onBack }: {
  screen: Extract<Screen, { kind: 'form' }>; existing: Weight | undefined; unit: WeightUnit; error?: string; saveError: string;
  onDay: (day: string) => void; onText: (text: string) => void; onUnit: (unit: WeightUnit) => void;
  onSave: () => void; onDelete: () => void; onBack: () => void;
}) {
  const p = palettes.light;
  const { day, text, editing } = screen;
  const replacing = existing !== undefined && !editing;
  return <Phone title={editing ? 'Edit Weigh-In' : 'Log Weigh-In'} onBack={onBack} backLabel="Cancel"
    footer={<View style={{ padding: 18, gap: 8, backgroundColor: p.surface }}>
      <Button primary onPress={onSave}>{replacing ? 'Replace weigh-in' : 'Save weigh-in'}</Button>
      {editing ? <Button danger onPress={onDelete}>Delete weigh-in</Button> : null}
    </View>}>
    <View style={{ padding: 18, gap: 24, backgroundColor: p.surface, flexGrow: 1 }}>
      <View style={{ gap: 8 }}>
        <Label accessibilityRole="header" size={21} weight="600">{editing ? 'Correct this weigh-in' : 'Record your weight'}</Label>
        <Label muted size={12}>One weigh-in per day. It stays on the day you choose, even if you travel to another time zone.</Label>
      </View>
      {editing ? <Label weight="500">{long(day)}</Label> : <Row style={{ justifyContent: 'space-between' }}>
        <Chevron label="Previous day" onPress={() => onDay(addDays(day, -1))}>‹</Chevron>
        <Label accessibilityLiveRegion="polite" weight="500" style={{ flex: 1, textAlign: 'center' }}>
          {day === localDay() ? `Today, ${short(day)}` : long(day)}
        </Label>
        {/* Weigh-ins are for days that have happened, so the next-day button stops at today. */}
        {day < localDay() ? <Chevron label="Next day" onPress={() => onDay(addDays(day, 1))}>›</Chevron> : <View style={{ width: 44 }} />}
      </Row>}
      <Field label="Weight" a11y={`Weight in ${UNIT_NAMES[unit].toLowerCase()}`} value={text} onChangeText={onText}
        suffix={unit} placeholder={unit === 'kg' ? 'e.g. 80.5' : 'e.g. 177.5'} keyboardType="decimal-pad" error={error}
        autoFocus={!editing} />
      <Segments label="Weight unit" values={UNITS} names={UNIT_NAMES} selected={unit} onChange={(u) => onUnit(u as WeightUnit)} />
      {replacing ? <Label accessibilityRole="alert" size={13} style={{ color: p.warning }}>
        {`${long(day)} already has a weigh-in of ${formatWeight(existing.kg, unit)}. Saving replaces it.`}
      </Label> : null}
      <Label muted size={12}>Stored in kilograms. Pounds convert at exactly 0.45359237 kg per lb.</Label>
      {saveError ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{saveError}</Label> : null}
    </View>
  </Phone>;
}

/** Weight history: record, correct, or remove one weigh-in per day, with a labelled 7-day average. */
export default function WeightHistory({ onClose }: { onClose: () => void }) {
  const db = useSQLiteContext();
  const [weights, setWeights] = useState<Weight[]>([]);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  const [error, setError] = useState<string>();
  const [saveError, setSaveError] = useState('');
  // Synchronous lock: a second tap can land before React re-renders after the first.
  const writing = useRef(false);

  const reload = useCallback(async () => {
    setWeights(await listWeights(db));
    setUnit(await loadWeightUnit(db));
  }, [db]);
  useEffect(() => {
    reload();
  }, [reload]);

  function go(next: Screen) {
    setScreen(next);
    setError(undefined);
    setSaveError('');
  }

  async function write(action: () => Promise<void>, next: Screen) {
    if (writing.current) return;
    writing.current = true;
    try {
      await action();
      await reload();
      go(next);
    } catch {
      setSaveError('Could not save. Your changes are still here; try again.');
    } finally {
      writing.current = false;
    }
  }

  const changeUnit = (next: WeightUnit) => write(() => saveWeightUnit(db, next), screen);

  if (screen.kind === 'form') {
    const existing = weights.find((w) => w.day === screen.day);
    return <WeighInForm screen={screen} existing={existing} unit={unit} error={error} saveError={saveError}
      onBack={() => go({ kind: 'list' })}
      onDay={(day) => go({ ...screen, day })}
      onText={(text) => {
        setError(undefined);
        setScreen({ ...screen, text });
      }}
      onUnit={changeUnit}
      onSave={() => {
        const { prefill } = screen;
        const untouched = existing && prefill && prefill.text === screen.text && prefill.unit === unit;
        const result = untouched ? { kg: existing.kg } : parseWeight(screen.text, unit);
        if ('error' in result) return setError(result.error);
        const w = { day: screen.day, kg: result.kg };
        write(() => (existing ? updateWeight(db, w) : insertWeight(db, w)), { kind: 'list' });
      }}
      onDelete={() => write(() => deleteWeight(db, screen.day), { kind: 'list' })} />;
  }

  return <Phone dark title="Weight Trend" onBack={onClose} backLabel="Back to food log"
    footer={<View style={{ padding: 16, backgroundColor: palettes.dark.surface }}>
      <Button primary onPress={() => go({ kind: 'form', day: localDay(), text: '', editing: false, prefill: null })}>
        Log weigh-in
      </Button>
    </View>}>
    <HistoryBody weights={weights} unit={unit} onUnit={changeUnit}
      onWeight={(w) => {
        const text = number(w.kg, unit);
        go({ kind: 'form', day: w.day, text, editing: true, prefill: { text, unit } });
      }} />
  </Phone>;
}
