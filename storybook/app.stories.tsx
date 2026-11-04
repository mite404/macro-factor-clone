import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import App from '../src/App';
import { restoreBackup, type Backup } from '../src/features/backup/backup';
import v1Backup from '../src/features/backup/backup-v1.json';
import { insertEntry, localDay } from '../src/features/diary/diary';
import { insertFood } from '../src/features/foods/foods';
import type { Db } from '../src/storage/migrations';

// Each story renders the production app on its own fresh in-memory SQLite database (see sqlite.tsx).
const meta = {
  title: 'App',
  component: App,
  // The live app fills the screen, as it does on a phone and in the Expo web build.
  decorators: [(Story) => <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}><Story /></div>],
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;

const yogurt = { name: 'Greek yogurt', basis: 'g', calories: 123, protein: 8, carbs: null, fat: null, serving: null, barcode: null } as const;

async function seedYogurtLog(db: Db) {
  const foodId = await insertFood(db, yogurt);
  await insertEntry(db, { day: localDay(), label: yogurt.name, calories: 184.5, protein: 12, carbs: null, fat: null }, { foodId, amount: 150, unit: 'g' });
}

async function seedRiceToday(db: Db) {
  const foodId = await insertFood(db, { name: 'Rice', basis: 'g', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, serving: null, barcode: null });
  await insertEntry(db, { day: localDay(), label: 'Rice', calories: 260, protein: 5.4, carbs: 56, fat: 0.6 }, { foodId, amount: 200, unit: 'g' });
}

// The web picker appends a hidden file input and clicks it; this chooses `text` as the picked file.
async function pickFile(canvas: ReturnType<typeof within>, text: string) {
  await userEvent.click(canvas.getByRole('button', { name: 'Choose backup file' }));
  const input = await waitFor(() => {
    const found = document.querySelector<HTMLInputElement>('input[type=file]');
    if (!found) throw new Error('file input not opened');
    return found;
  });
  await userEvent.upload(input, new File([text], 'backup.json', { type: 'application/json' }));
}

async function replace(input: HTMLElement, text: string) {
  await userEvent.clear(input);
  await userEvent.type(input, text);
}

export const EmptyDiary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No entries for this day yet.')).toBeVisible();
    await expect(canvas.getByLabelText('Total 0 kilocalories, protein 0 g, fat 0 g, carbs 0 g')).toBeVisible();
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
    await expect(await canvas.findByText('350')).toBeVisible();
    await expect(canvas.getByText('≥5')).toBeVisible();
    await expect(canvas.getByText('Macro totals incomplete: 1 entry has unknown macros.')).toBeVisible();
    await expect(canvas.getByText('200 kcal ? P ? F ? C')).toBeVisible();
  },
};

export const QuickAddValidationAndCorrection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Quick add' }));
    const calories = canvas.getByLabelText('Calories in kilocalories');
    await userEvent.click(canvas.getByRole('button', { name: 'Log Food' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Calories are required');
    await userEvent.type(calories, 'abc');
    await userEvent.click(canvas.getByRole('button', { name: 'Log Food' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter a number of 0 or more');
    await replace(calories, '250');
    await expect(canvas.queryByRole('alert')).toBeNull();
    await userEvent.type(canvas.getByLabelText('Protein in grams'), '0');
    await userEvent.click(canvas.getByRole('button', { name: 'Log Food' }));
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
    await userEvent.click(await canvas.findByRole('button', { name: 'Search for a food' }));
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
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));
    await expect(await canvas.findByRole('button', { name: /^Greek yogurt, 150 g, 184.5 kilocalories/ })).toBeVisible();
  },
};

export const SavedFoodEditKeepsHistory: Story = {
  args: { onInit: seedYogurtLog },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Search for a food' }));
    await userEvent.type(canvas.getByLabelText('Search saved foods'), 'yog');
    await userEvent.click(await canvas.findByRole('button', { name: 'Greek yogurt, 123 kilocalories per 100 g' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Food' }));
    await replace(canvas.getByLabelText('Calories per 100 grams'), '140');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await userEvent.type(await canvas.findByLabelText('Amount in grams'), '100');
    await expect(canvas.getByText('100 g: 140 kcal · P 8 · C ? · F ? g')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Close logger' }));
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
    await userEvent.click(await canvas.findByRole('button', { name: 'Search for a food' }));
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
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));
    await expect(await canvas.findByRole('button', { name: /^Orange juice, 660 ml, 297 kilocalories/ })).toBeVisible();
  },
};

export const BackupExport: Story = {
  args: { onInit: (db) => restoreBackup(db, v1Backup as Backup) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const downloads: Blob[] = [];
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => {
      downloads.push(blob);
      return createObjectURL(blob);
    };
    try {
      await userEvent.click(await canvas.findByRole('button', { name: 'Settings' }));
      await userEvent.click(await canvas.findByRole('button', { name: 'Export backup' }));
      await waitFor(() => expect(downloads).toHaveLength(1));
    } finally {
      URL.createObjectURL = createObjectURL;
    }
    const exported = JSON.parse(await downloads[0].text());
    await expect(Date.parse(exported.exportedAt)).not.toBeNaN();
    await expect({ ...exported, exportedAt: v1Backup.exportedAt }).toEqual(v1Backup);
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

export const BackupRestoreConfirmation: Story = {
  args: { onInit: seedRiceToday },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Settings' }));
    await pickFile(canvas, JSON.stringify(v1Backup));
    await expect(await canvas.findByText('2 saved foods (1 archived) and 3 diary entries on 2 days, 2026-10-30 to 2026-10-31.')).toBeVisible();
    await expect(canvas.getByText(`Your current 1 saved food and 1 diary entry on ${localDay()} will be deleted, not merged. This cannot be undone.`)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(await canvas.findByText('Restore cancelled. Your data was not changed.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Back to food log' }));
    await expect(await canvas.findByRole('button', { name: /^Rice, 200 g, 260 kilocalories/ })).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    await pickFile(canvas, JSON.stringify(v1Backup));
    await userEvent.click(await canvas.findByRole('button', { name: 'Replace all data' }));
    await expect(await canvas.findByText('Restored 2 saved foods (1 archived) and 3 diary entries on 2 days, 2026-10-30 to 2026-10-31.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Back to food log' }));
    await expect(await canvas.findByText('No entries for this day yet.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Search for a food' }));
    await expect(await canvas.findByRole('button', { name: 'Oats, 379 kilocalories per 100 g' })).toBeVisible();
    await expect(canvas.queryByText('Rice')).toBeNull();
    await expect(canvas.queryByText('Orange juice')).toBeNull();
  },
};

export const BackupRestoreRejectsInvalidFiles: Story = {
  args: { onInit: seedRiceToday },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Settings' }));
    const dangling = { ...v1Backup, diaryEntries: [{ ...v1Backup.diaryEntries[1], foodId: 3 }] };
    const files: [string, string][] = [
      ['{"format": "nutrition-diary-backup",', 'This file is not valid JSON, so it cannot be a backup.'],
      [JSON.stringify({ ...v1Backup, version: 2 }), 'This backup was made by a newer version of the app (format 2). Update the app to restore it.'],
      [JSON.stringify(dangling), 'Diary entry 7 refers to food 3, which is not in the backup.'],
    ];
    for (const [text, reason] of files) {
      await pickFile(canvas, text);
      await expect(await canvas.findByRole('alert')).toHaveTextContent(`Not restored. ${reason} Your data was not changed.`);
      await expect(canvas.queryByRole('button', { name: 'Replace all data' })).toBeNull();
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Back to food log' }));
    await expect(await canvas.findByRole('button', { name: /^Rice, 200 g, 260 kilocalories/ })).toBeVisible();
  },
};
