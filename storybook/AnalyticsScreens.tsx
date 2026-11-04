import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, colors, Label, Macros, Phone, Row, Segments, Sparkline, usePalette } from '../src/ui';

const expenditure = [.14, .15, .18, .23, .25, .28, .30, .35, .48, .60, .69, .74, .77,
  .78, .77, .76, .75, .74, .72, .69, .66, .64, .62, .61];
const weightTrend = [.85, .80, .73, .63, .54, .48, .44];

function WeeklyNutrition({ remaining }: { remaining: boolean }) {
  const p = usePalette();
  const tints = [colors.calories, colors.protein, colors.fat, colors.carbs];
  return <Row style={{ alignItems: 'flex-start', gap: 16, marginVertical: 18 }}>
    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, dayIndex) => <View key={dayIndex}
        style={{ gap: 12, alignItems: 'center', padding: 5, borderRadius: 5,
          borderWidth: 1, borderColor: dayIndex === 0 ? p.text : 'transparent' }}>
        {tints.map((tint, i) => <View key={tint}
          style={{ height: 34, width: 19, backgroundColor: p.background,
            justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 3 }}>
          <View style={{ height: dayIndex < 4 ? (remaining ? 8 : 24 + (i + dayIndex) % 3 * 2) : 0,
            width: 5, backgroundColor: tint }} />
          <View style={{ position: 'absolute', top: 5, width: 6, height: 1,
            backgroundColor: dayIndex < 4 ? p.text : p.border }} />
        </View>)}
        <Label size={12} muted>{day}</Label>
      </View>)}
    </View>
    <View style={{ width: 65, gap: 14, paddingTop: 8 }}>
      {(remaining ? ['−124', '0 P', '0 F', '3 C'] : ['1923 ♨', '115 P', '59 F', '196 C']).map((n, i) =>
        <View key={n}><Label size={16}>{n}</Label>
          <Label size={11} muted>of {['1799', '115', '59', '199'][i]}</Label></View>)}
    </View>
  </Row>;
}

function DashboardBody({ daily }: { daily: boolean }) {
  const [mode, setMode] = useState('Consumed');
  const p = usePalette();
  return <>
    <View style={{ backgroundColor: p.surface, padding: 20, paddingTop: daily ? 20 : 32 }}>
      <Label size={12} muted>THURSDAY, SEPTEMBER 25</Label>
      <Label size={29} weight="800" style={{ letterSpacing: -1.3 }}>{daily ? 'Dashboard' : 'DASHBOARD'}</Label>
      <Label size={20} weight="600" style={{ marginTop: 16 }}>{daily ? 'Daily' : 'Weekly'} Nutrition</Label>
      {daily ? <View style={{ gap: 16, marginVertical: 16 }}>
        <Row style={{ justifyContent: 'space-around' }}>
          <View><Label size={18}>535</Label><Label size={11} muted>Remaining</Label></View>
          <View style={{ width: 128, height: 128, borderRadius: 64, borderWidth: 3,
            borderColor: colors.calories, borderBottomColor: p.field,
            alignItems: 'center', justifyContent: 'center' }}>
            <Label size={32}>{mode === 'Consumed' ? '2108' : '535'}</Label><Label muted size={11}>{mode}</Label>
          </View>
          <View><Label size={18}>2643</Label><Label size={11} muted>Target</Label></View>
        </Row>
        <Row style={{ gap: 22 }}>
          {['Protein', 'Fat', 'Carbs'].map((name, i) => <View key={name} style={{ flex: 1, gap: 6 }}>
            <Label size={11} muted style={{ textAlign: 'center' }}>{name}</Label>
            <View style={{ height: 3, backgroundColor: p.field }}>
              <View style={{ height: 3, width: '74%', backgroundColor: [colors.protein, colors.fat, colors.carbs][i] }} />
            </View>
            <Label size={11} style={{ textAlign: 'center' }}>{mode === 'Consumed'
              ? ['103 / 126 g', '94 / 58 g', '218 / 403 g'][i] : ['23 g', '−36 g', '185 g'][i]}</Label>
          </View>)}
        </Row>
      </View> : <WeeklyNutrition remaining={mode === 'Remaining'} />}
      <Segments values={['Consumed', 'Remaining']} selected={mode} onChange={setMode} />
    </View>
    <Label muted style={{ textAlign: 'center', padding: 9 }}>• · ·</Label>
    <View style={{ padding: 16, gap: 14 }}>
      <Label size={20} weight="600">{daily ? 'Habits' : 'Insights & Analytics'}</Label>
      {daily ? <Row style={{ gap: 10 }}>
        {['Weigh-In', 'Food Logging'].map((name, n) => <Card key={name} style={{ flex: 1 }}>
          <Label>{name}</Label><Label size={11} muted>Last 30 Days</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {Array.from({ length: 28 }, (_, i) => <View key={i} style={{ width: 12, height: 12,
              borderRadius: 2, backgroundColor: i % 6 === 0 ? p.field : n ? colors.calories : colors.carbs }} />)}
          </View><Label size={12}>6/7 this week    ›</Label>
        </Card>)}
      </Row> : <Row style={{ gap: 10 }}>
        {[['Expenditure', colors.expenditure], ['Weight Trend', colors.weight]].map(([name, color], i) =>
          <Card key={name} style={{ flex: 1, padding: 14 }}>
            <Label size={16}>{name}</Label><Label size={12} muted>Last 7 Days</Label>
            <Sparkline values={i ? [.2, .2, .2, .2, .55, .55, .55] : [.45, .44, .42, .40, .38, .35, .34]}
              color={color} />
            <Label size={20}>{i ? '153.5' : '2099'} <Label size={11} muted>{i ? 'lbs' : 'kcal'}</Label></Label>
          </Card>)}
      </Row>}
      <Label size={20} weight="600">{daily ? 'Upper Body' : 'Nutrition'}</Label>
      <Card><Macros values={['1923', '115', '59', '196']} targets={['1799', '115 g', '59 g', '199 g']} /></Card>
    </View>
  </>;
}

/** Reconstructs the light weekly dashboard or the historical dark daily dashboard. */
export function Dashboard({ daily = false }: { daily?: boolean }) {
  return <Phone dark={daily} tab="Dashboard" search={!daily}><DashboardBody daily={daily} /></Phone>;
}

function TrendBody({ weight }: { weight: boolean }) {
  const p = usePalette();
  const color = weight ? colors.weight : colors.expenditure;
  return <>
    <View style={{ backgroundColor: p.surface, padding: 18, gap: 12 }}>
      <Row style={{ gap: 45 }}>
        <View><Label size={12} muted>Average</Label><Label size={28}>{weight ? '153.5' : '2099'}
          <Label size={12} muted> {weight ? 'lbs' : 'kcal'}</Label></Label></View>
        <View><Label size={12} muted>Difference</Label><Label size={25} weight="600">{weight ? '−1.6' : '+38'}
          <Label size={12} muted> {weight ? 'lbs' : 'kcal'}</Label></Label></View>
        <Button label="Chart settings">↥</Button>
      </Row>
      <Label>{weight ? 'Apr 6 – Apr 12, 2025' : 'Aug 19 – Sep 17, 2025'}</Label>
      <View style={{ height: 290, marginTop: 6 }}>
        {[0, 1, 2].map((n) => <Row key={n} style={{ position: 'absolute', top: n * 130, width: '100%', gap: 8 }}>
          <View style={{ flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: p.border }} />
          <Label size={11} muted>{weight ? [155, 150, 145][n] : [2150, 2100, 2050][n]}</Label>
        </Row>)}
        <View style={{ position: 'absolute', top: 14, left: 0 }}>
          <Sparkline values={weight ? weightTrend : expenditure} color={color} width={312} height={246} />
        </View>
        {weight ? <View style={{ position: 'absolute', top: 14, left: 0 }}>
          <Sparkline values={[.72, .47, .53, .27, .18, .33, .38]} color="#625098"
            width={312} height={246} dots={false} />
        </View> : null}
        <Row style={{ position: 'absolute', bottom: 3, width: 312, justifyContent: 'space-between' }}>
          {(weight ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Aug 23', 'Aug 28', 'Sep 2', 'Sep 7', 'Sep 12', 'Sep 17'])
            .map(day => <Label key={day} size={10} muted>{day}</Label>)}
        </Row>
      </View>
      <Segments values={['1W', '1M', '3M', '6M', '1Y', 'All']} selected={weight ? '1W' : '1M'} />
    </View>
    <View style={{ padding: 16, gap: 26 }}>
      <Card><Label size={12} style={{ textAlign: 'center', color }}>{weight
        ? '⌁ Scale Weight          ◇ Trend Weight' : '▲ Flux Range       ⊙ Updating       ▫ Holding'}</Label></Card>
      <Label size={20} weight="600">Insights & Data</Label>
      <Card><Label size={17}>{weight ? 'Weight' : 'Expenditure'} Changes</Label>
        {['3-day', '7-day', '14-day', '30-day'].map((day, i) => <Row key={day} style={{ gap: 12 }}>
          <Label muted size={12} style={{ flex: 1 }}>{day}</Label>
          <Sparkline color={color} width={40} height={25} values={[.8, .3, .3]} dots={false} />
          <Label size={12}>{weight ? ['−0.3', '−1.6', '−2.1', '−3.4'][i] + ' lbs' : ['−1', '−9', '+12', '+38'][i] + ' kcal'}</Label>
          <Label muted size={11}>{!weight && i > 1 ? '↗ Increase' : '↘ Decrease'}</Label>
        </Row>)}
      </Card>
    </View>
  </>;
}

/** Chart screens preserve source layout; plotted points are illustrative fixtures. */
export function Trend({ weight = false }: { weight?: boolean }) {
  return <Phone dark={weight} title={weight ? 'Weight Trend' : 'Expenditure'}><TrendBody weight={weight} /></Phone>;
}

/** Historical body-metrics overview without reproducing the source subject's personal photograph. */
export function BodyMetrics() {
  return <Phone title="Body Metrics"><View style={{ padding: 16, gap: 18 }}>
    <Label weight="600" size={17}>Weight & Body Fat</Label>
    <Row style={{ gap: 10 }}>{['Scale Weight', 'Visual Body Fat'].map((name, i) =>
      <Card key={name} style={{ flex: 1, padding: 12 }}>
        <Label>{name}</Label><Label size={11} muted>Last 7 Entries</Label>
        <Sparkline color={colors.carbs} values={[.35, .45, .40, .45, .65, .65, .65]} />
        <Label>{i ? '31.0 %' : '180.3 lbs'}    ›</Label>
      </Card>)}</Row>
    <Label weight="600" size={17}>Visual & Metric Overview</Label>
    <Card><Row style={{ gap: 16 }}>
      <View style={{ height: 120, width: 125, backgroundColor: '#e7e7e7', alignItems: 'center', justifyContent: 'center' }}>
        <Label muted size={12}>Photo omitted</Label>
      </View><View style={{ gap: 9 }}><Label>Full Body</Label><Label muted size={11}>Nov 15, 2024</Label>
        <Label size={12}>42 in         14 in</Label><Label size={11} muted>Shoulders    Neck</Label>
        <Label size={12}>3 metrics       ›</Label></View>
    </Row></Card>
    <Label weight="600" size={17}>Upper Body</Label>
    <Row style={{ gap: 10 }}>{['Neck', 'Shoulders'].map((name, i) => <Card key={name} style={{ flex: 1, padding: 12 }}>
      <Label>{name}</Label><Label muted size={11}>Last 7 Entries</Label>
      <Sparkline color={colors.carbs} values={[.3, .3, .28, .32, .62, .42, .3]} />
      <Label>{i ? '42.0' : '14.0'} in   ›</Label>
    </Card>)}</Row>
  </View></Phone>;
}
