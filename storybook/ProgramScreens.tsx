import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, colors, Field, Label, Phone, Row, usePalette } from '../src/ui';

function WeekProgram({ compact = false }: { compact?: boolean }) {
  return <Row style={{ gap: 5, alignItems: 'flex-end' }}>
    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <View key={i} style={{ flex: 1, gap: 5, alignItems: 'stretch' }}>
      <View style={{ backgroundColor: colors.calories, paddingVertical: 6, borderRadius: 14 }}>
        <Label size={9} style={{ color: '#101010', textAlign: 'center' }}>{i === 4 || i === 5 ? '2050' : '1864'}</Label>
      </View>
      {[[colors.protein, '118 P'], [colors.fat, '61 F'], [colors.carbs, '209 C']].slice(0, compact ? 1 : 3)
        .map(([color, value], n) => <View key={color} style={{ height: compact ? 30 : [50, 60, 85][n],
          backgroundColor: color, justifyContent: 'center' }}>
          <Label size={9} style={{ color: '#101010', textAlign: 'center' }}>{value}</Label>
        </View>)}
      <Label size={11} muted style={{ textAlign: 'center' }}>{day}</Label>
    </View>)}
  </Row>;
}

function StrategyBody() {
  const p = usePalette();
  return <>
    <View style={{ padding: 20, paddingTop: 46, backgroundColor: p.surface, gap: 20 }}>
      <Label size={30} weight="800" style={{ letterSpacing: -1 }}>STRATEGY</Label>
      <Row style={{ gap: 6 }}><Button style={{ paddingHorizontal: 10 }}>+ New Goal</Button>
        <Button style={{ paddingHorizontal: 10 }}>✎ Edit Goal</Button>
        <Button style={{ paddingHorizontal: 10 }}>⟳ New Program</Button></Row>
      <View style={{ alignItems: 'center', paddingVertical: 34 }}>
        <View style={{ width: 188, height: 188, borderRadius: 100, backgroundColor: p.text,
          alignItems: 'center', justifyContent: 'center' }}>
          <Label size={30} weight="600" style={{ color: p.inverse }}>Check In</Label>
          <Label size={13} style={{ color: p.inverse }}>it's time</Label>
        </View>
      </View>
    </View>
    <View style={{ padding: 16, gap: 16, paddingTop: 32 }}>
      <Label size={20} weight="600">In Progress</Label>
      <Card><Label size={17}>Coached Program</Label><Label size={12} muted>Mar 10 – Now</Label><WeekProgram compact /></Card>
    </View>
  </>;
}

/** Due-check-in Strategy screen from the 2026 press kit. */
export function Strategy() { return <Phone dark tab="Strategy"><StrategyBody /></Phone>; }

/** Program update is a visual reference, not an implementation of adaptive coaching. */
export function ProgramUpdate() {
  return <Phone title="Program Update" footer={<View style={{ padding: 16, gap: 8, backgroundColor: '#fff' }}>
    <Button>Decline and Silence</Button><Button primary>Accept Program Changes</Button>
  </View>}><View style={{ padding: 18, gap: 24, backgroundColor: '#fff' }}>
    <View style={{ height: 3, backgroundColor: '#e8e8e8' }}><View style={{ width: '66%', height: 3, backgroundColor: '#111' }} /></View>
    <Label size={21} weight="600">Your program update is here!</Label><WeekProgram />
    <Label size={17} weight="600">What changed?</Label>
    {['Your average Calories will increase by 22 kcal for next week.',
      'Your average Protein will remain the same for next week.',
      'Your average Fat will increase by 1 g for next week.'].map((text, i) =>
      <Row key={text} style={{ gap: 16, alignItems: 'flex-start' }}>
        <View style={{ padding: 12, borderRadius: 22, backgroundColor: '#f1f1f1' }}><Label>{['♨', 'P', 'F'][i]}</Label></View>
        <Label size={13} style={{ flex: 1, paddingTop: 6 }}>{text}</Label>
      </Row>)}
  </View></Phone>;
}

function Choices({ recipe }: { recipe: boolean }) {
  const [selected, setSelected] = useState(recipe ? 'Import with AI' : 'Coached');
  const p = usePalette();
  const choices = recipe ? [
    ['Build from scratch', 'Manually enter each ingredient and preparation step'],
    ['Import from Link', 'Import a recipe from the web or social media'],
    ['Import with AI', 'Import a recipe using a photo, text, or both'],
  ] : [
    ['Coached', "We'll design a Calorie and macro program based on your goal and preferences."],
    ['Collaborative', "Set your own macro targets and we'll adjust your Calorie budget based on your goal and progress."],
    ['Manual', 'Set your own macro and Calorie targets using manual entry.'],
  ];
  return <View style={{ padding: 18, gap: 22, backgroundColor: p.surface, minHeight: 620 }}>
    <View style={{ height: 3, backgroundColor: p.border }}><View style={{ width: '25%', height: 3, backgroundColor: p.text }} /></View>
    <Label size={21} weight="600">{recipe ? 'How would you like to build your recipe?' : 'Which program style would you like to use?'}</Label>
    {choices.map(([name, description]) => <Pressable key={name} accessibilityRole="radio"
      accessibilityLabel={name} aria-checked={selected === name} onPress={() => setSelected(name)}
      style={{ borderRadius: 10, borderWidth: selected === name ? 2 : 1,
        borderColor: selected === name ? p.text : p.border, padding: 17 }}>
      <Row style={{ gap: 16 }}><View style={{ flex: 1, gap: 6 }}><Label weight="600">{name}</Label>
        <Label size={12} muted>{description}</Label></View><Label>{selected === name ? '●' : '○'}</Label></Row>
    </Pressable>)}
  </View>;
}

/** Observed single-choice program and recipe-method states, with local selection only. */
export function ChooseMode({ recipe = false }: { recipe?: boolean }) {
  return <Phone title={recipe ? 'Create Recipe' : 'Set New Program'}
    footer={<View style={{ padding: 18, backgroundColor: '#fff' }}><Button primary>Next</Button></View>}>
    <Choices recipe={recipe} />
  </Phone>;
}

/** Reconstructed recipe fields from the 2026 product release, without AI or persistence. */
export function RecipeBuilder() {
  return <Phone title="Create Recipe" footer={<View style={{ padding: 18, backgroundColor: '#fff' }}><Button primary>Next</Button></View>}>
    <View style={{ padding: 18, gap: 20, backgroundColor: '#fff' }}>
      <View style={{ height: 3, backgroundColor: '#ddd' }}><View style={{ width: '75%', height: 3, backgroundColor: '#111' }} /></View>
      <Label size={21} weight="600">Build your recipe</Label>
      <Field label="Recipe Name" value="Mushroom Medley Frittata" />
      <Field label="Serving Quantity" value="4" />
      <Field label="Total Weight" value="" placeholder="Enter weight after preparation" suffix="g" />
      <Label muted size={12}>Weight for all servings this recipe makes combined</Label>
      <Row style={{ justifyContent: 'space-between' }}><View style={{ gap: 6 }}><Label>Ingredients</Label>
        <Label size={12} muted>Weight of ingredients is 816.7 g</Label></View><Button>+</Button></Row>
      {[['🫒', 'Olive Oil', '248 ♨  0 P  28 F  0 C · 27 g', '2 tbsp'],
        ['🌿', 'Parsley, Fresh', '1 ♨  0 P  0 F  0 C · 3.75 g', '1 tbsp'],
        ['🧄', 'Garlic, Fresh', '8 ♨  0 P  0 F  2 C · 6 g', '2 clove']].map(([icon, name, macros, amount]) =>
        <Row key={name} style={{ gap: 12 }}><Label size={25}>{icon}</Label><View style={{ flex: 1 }}>
          <Label size={13}>{name}</Label><Label size={11} muted>{macros}</Label></View><Button>{amount}</Button></Row>)}
    </View>
  </Phone>;
}

/** Historical timeline preferences with the observed nutrient-reporting selection. */
export function TimelineSettings() {
  return <Phone title="Food Log"><View style={{ padding: 16, gap: 20 }}>
    <Label weight="600">Nutrient Reporting</Label><Card>
      <Row><View style={{ flex: 1, gap: 5 }}><Label>No Overages</Label>
        <Label muted size={12}>No negative numbers will be used if you exceed a nutrient target</Label></View><Label>○</Label></Row>
      <View style={{ height: 1, backgroundColor: '#eee' }} />
      <Row><View style={{ flex: 1, gap: 5 }}><Label>Show Overages</Label>
        <Label muted size={12}>Negative numbers will be used in nutrient remaining views if you exceed your target</Label></View><Label>●</Label></Row>
    </Card>
    <Label weight="600" style={{ marginTop: 12 }}>Timeline Options</Label><Card>
      {[['Hour Range', '7 AM – 11 PM'], ['Alignment', 'Right aligned'], ['Add Foods to Hour', 'Plus icon next to each hour'],
        ['Food Timestamps', 'Show timestamps'], ['Hourly Macro Totals', 'Show'], ['Calendar Week Banner', 'Show & Pin']]
        .map(([name, detail]) => <Row key={name} style={{ borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 10 }}>
          <View style={{ flex: 1, gap: 4 }}><Label size={13}>{name}</Label><Label muted size={11}>{detail}</Label></View>
          <Button>Edit</Button>
        </Row>)}
    </Card>
  </View></Phone>;
}
