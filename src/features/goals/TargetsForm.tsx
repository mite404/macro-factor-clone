// Laid out like CreateFood: title bar with Cancel, a heading, labelled fields, and a pinned Save.
import { View } from 'react-native';

import { Button, Field, Label, palettes, Phone, Row } from '../../ui';
import type { NutritionForm } from '../diary/diary';
import type { TargetErrors } from './goals';

const macroFields = [['protein', 'Protein'], ['fat', 'Fat'], ['carbs', 'Carbs']] as const;

/** Edits the one current target set. Every target is optional and entered on its own. */
export function TargetsForm({ form, errors, error, onField, onSave, onBack }: {
  form: NutritionForm; errors: TargetErrors; error: string;
  onField: (key: keyof NutritionForm, text: string) => void; onSave: () => void; onBack: () => void;
}) {
  const p = palettes.light;
  return <Phone title="Daily Targets" onBack={onBack} backLabel="Cancel"
    footer={<View style={{ padding: 18, backgroundColor: p.surface }}><Button primary onPress={onSave}>Save targets</Button></View>}>
    <View style={{ padding: 18, gap: 24, backgroundColor: p.surface, flexGrow: 1 }}>
      <View style={{ gap: 8 }}>
        <Label accessibilityRole="header" size={21} weight="600">Set your daily targets</Label>
        <Label muted size={12}>
          One set of targets applies to every day you view. Changing it never changes what you logged.
        </Label>
      </View>
      <Field label="Energy" a11y="Calorie target in kilocalories" value={form.calories}
        onChangeText={t => onField('calories', t)} suffix="kcal" placeholder="No target" keyboardType="decimal-pad"
        error={errors.calories} />
      <Row style={{ gap: 12, alignItems: 'flex-start' }}>{macroFields.map(([key, name]) =>
        <Field key={key} label={name} a11y={`${name} target in grams`} value={form[key]} onChangeText={t => onField(key, t)}
          suffix="g" placeholder="None" keyboardType="decimal-pad" error={errors[key]} style={{ flex: 1 }} />)}
      </Row>
      <Label muted size={12}>
        Leave a target blank to track that nutrient without one. Calories and macros are separate targets and do not
        need to add up.
      </Label>
      {error ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{error}</Label> : null}
    </View>
  </Phone>;
}
