import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import App from '../src/App';
import { insertEntry, localDay } from '../src/features/diary/diary';
import { insertFood } from '../src/features/foods/foods';
import type { Db } from '../src/storage/migrations';

// Each story renders the production app on its own fresh in-memory SQLite database (see sqlite.tsx).
const meta = { title: 'App', component: App } satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;

const yogurt = { name: 'Greek yogurt', basis: 'g', calories: 123, protein: 8, carbs: null, fat: null, serving: null, barcode: null } as const;

async function seedYogurtLog(db: Db) {
  const foodId = await insertFood(db, yogurt);
  await insertEntry(db, { day: localDay(), label: yogurt.name, calories: 184.5, protein: 12, carbs: null, fat: null }, { foodId, amount: 150, unit: 'g' });
}

async function replace(input: HTMLElement, text: string) {
  await userEvent.clear(input);
  await userEvent.type(input, text);
}

export const EmptyDiary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No entries for this day yet.')).toBeVisible();
    await expect(canvas.getByLabelText('Total 0 kilocalories, protein 0 g, carbs 0 g, fat 0 g')).toBeVisible();
  },
};

export const PopulatedDiary: Story = {
  args: {
    onInit: async (db) => {
      await insertEntry(db, { day: localDay(), label: 'Oats', calories: 150, protein: 5, carbs: 27, fat: 3 });
      await insertEntry(db, { day: localDay(), label: 'Mystery bar', calories: 200, protein: null, carbs: null, fat: null });
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('350 kcal')).toBeVisible();
    await expect(canvas.getByText('Protein ≥5 g')).toBeVisible();
    await expect(canvas.getByText('Macro totals incomplete: 1 entry has unknown macros.')).toBeVisible();
    await expect(canvas.getByText('P ? · C ? · F ? g')).toBeVisible();
  },
};

export const QuickAddValidationAndCorrection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: '+ Quick add' }));
    const calories = canvas.getByLabelText('Calories in kilocalories');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Calories are required');
    await userEvent.type(calories, 'abc');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter a number of 0 or more');
    await replace(calories, '250');
    await userEvent.type(canvas.getByLabelText('Protein in grams'), '0');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    const entry = await canvas.findByRole('button', { name: /^Quick add, 250 kilocalories, protein 0, carbs \?, fat \?/ });
    await expect(canvas.getByText('Macro totals incomplete: 1 entry has unknown macros.')).toBeVisible();

    await userEvent.click(entry);
    await replace(canvas.getByLabelText('Calories in kilocalories'), '300');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await userEvent.click(await canvas.findByRole('button', { name: /^Quick add, 300 kilocalories/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Delete entry' }));
    await expect(await canvas.findByText('No entries for this day yet.')).toBeVisible();
  },
};

export const SavedFoodCreateAndLog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: '+ Log food' }));
    await expect(await canvas.findByText(/^No saved foods yet/)).toBeVisible();
    await userEvent.type(canvas.getByLabelText('Search saved foods'), 'Greek yogurt');
    await userEvent.click(await canvas.findByRole('button', { name: 'New food' }));
    await expect(canvas.getByLabelText('Name')).toHaveValue('Greek yogurt');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Calories are required');
    await userEvent.type(canvas.getByLabelText('Calories per 100 grams'), '123');
    await userEvent.type(canvas.getByLabelText('protein in grams per 100 grams'), '8');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await userEvent.type(await canvas.findByLabelText('Amount in grams'), '150');
    await expect(canvas.getByText('150 g: 184.5 kcal · P 12 · C ? · F ? g')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Log' }));
    await expect(await canvas.findByRole('button', { name: /^Greek yogurt, 150 g, 184.5 kilocalories/ })).toBeVisible();
  },
};

export const SavedFoodEditKeepsHistory: Story = {
  args: { onInit: seedYogurtLog },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: '+ Log food' }));
    await userEvent.type(canvas.getByLabelText('Search saved foods'), 'yog');
    await userEvent.click(await canvas.findByRole('button', { name: 'Greek yogurt, 123 kilocalories per 100 g' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Edit food' }));
    await replace(canvas.getByLabelText('Calories per 100 grams'), '140');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await userEvent.type(await canvas.findByLabelText('Amount in grams'), '100');
    await expect(canvas.getByText('100 g: 140 kcal · P 8 · C ? · F ? g')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Back to foods' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(await canvas.findByRole('button', { name: /^Greek yogurt, 150 g, 184.5 kilocalories/ })).toBeVisible();
  },
};

export const MeasuredServingWithKeyboard: Story = {
  args: {
    onInit: async (db) => {
      await insertFood(db, { name: 'Orange juice', basis: 'ml', calories: 45, protein: 0.7, carbs: 10.4, fat: 0.2, serving: { name: 'bottle', amount: 330 }, barcode: null });
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: '+ Log food' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Orange juice, 45 kilocalories per 100 ml' }));
    const millilitres = canvas.getByRole('radio', { name: 'Millilitres' });
    const bottle = canvas.getByRole('radio', { name: 'Servings of bottle (330 ml)' });
    await expect(millilitres).toBeChecked();
    bottle.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'Servings of bottle (330 ml)' })).toBeChecked());
    await expect(canvas.getByRole('radio', { name: 'Millilitres' })).not.toBeChecked();
    await userEvent.type(canvas.getByLabelText('Number of servings'), '2');
    await expect(canvas.getByText('660 ml: 297 kcal · P 4.6 · C 68.6 · F 1.3 g')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Log' }));
    await expect(await canvas.findByRole('button', { name: /^Orange juice, 660 ml, 297 kilocalories/ })).toBeVisible();
  },
};
