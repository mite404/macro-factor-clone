import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import App from '../src/App';
import { restoreBackup, type Backup } from '../src/features/backup/backup';
import v1Backup from '../src/features/backup/backup-v1.json';
import v2Backup from '../src/features/backup/backup-v2.json';
import { insertEntry, localDay } from '../src/features/diary/diary';
import { insertFood } from '../src/features/foods/foods';
import { saveTargets } from '../src/features/goals/goals';
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
    await expect(canvas.getByText('No daily targets set. Intake is shown without a goal.')).toBeVisible();
    await expect(canvas.queryByText(/^of /)).toBeNull();
  },
};

export const TargetsUnderAndIncomplete: Story = {
  args: {
    onInit: async (db) => {
      await saveTargets(db, { calories: 2000, protein: 100, fat: 70 });
      await insertEntry(db, { day: localDay(), label: 'Chicken rice', calories: 1200, protein: 40, carbs: 150, fat: 20 });
      await insertEntry(db, { day: localDay(), label: 'Mystery bar', calories: 300, protein: null, carbs: null, fat: 12 });
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Current targets')).toBeVisible();
    await expect(canvas.getByText('1500 of 2000 kcal')).toBeVisible();
    await expect(canvas.getByText('500 kcal left')).toBeVisible();
    await expect(canvas.getByText('at least 40 of 100 g')).toBeVisible();
    await expect(canvas.getByText('incomplete: 1 entry has unknown protein')).toBeVisible();
    await expect(canvas.getByText('32 of 70 g')).toBeVisible();
    await expect(canvas.getByText('38 g left')).toBeVisible();
    await expect(canvas.queryByText(/Carbs.*left/)).toBeNull();
  },
};

export const TargetsOver: Story = {
  args: {
    onInit: async (db) => {
      await saveTargets(db, { calories: 2000 });
      await insertEntry(db, { day: localDay(), label: 'Lunch', calories: 1400, protein: 50, carbs: 160, fat: 40 });
      await insertEntry(db, { day: localDay(), label: 'Dinner', calories: 750, protein: 30, carbs: 80, fat: 25 });
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('2150 of 2000 kcal')).toBeVisible();
    await expect(canvas.getByText('150 kcal over')).toBeVisible();
    await expect(canvas.queryByText(/left/)).toBeNull();
  },
};

// Stands in for iOS Dynamic Type in the browser: every rendered font size and line height × 1.5.
function enlargeText(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    if (!el.style.fontSize) continue;
    el.style.fontSize = `${parseFloat(el.style.fontSize) * 1.5}px`;
    if (el.style.lineHeight) el.style.lineHeight = `${parseFloat(el.style.lineHeight) * 1.5}px`;
  }
}

export const TargetsLargeText: Story = {
  args: {
    onInit: async (db) => {
      await saveTargets(db, { calories: 2000, protein: 100, fat: 70, carbs: 250 });
      for (const [label, calories] of [['Breakfast', 450], ['Lunch', 700], ['Snack', 250], ['Dinner', 600], ['Dessert', 150]] as const) {
        await insertEntry(db, { day: localDay(), label, calories, protein: 16, carbs: 48, fat: 13 });
      }
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('2150 of 2000 kcal')).toBeVisible();
    enlargeText(canvasElement);
    // Each total stays whole on one line: no ellipsis and no break between digits.
    await waitFor(() => {
      for (const value of ['2150', '80', '65', '240']) {
        const el = canvas.getByText(value);
        expect(el.scrollWidth, `${value} is cut off`).toBeLessThanOrEqual(el.clientWidth);
        expect(el.getBoundingClientRect().height, `${value} wraps`).toBeLessThan(parseFloat(getComputedStyle(el).lineHeight) * 1.5);
      }
    });
    const last = canvas.getByRole('button', { name: /^Dessert, 150 kilocalories/ });
    last.scrollIntoView({ block: 'end' });
    const footer = canvas.getByRole('button', { name: 'Search for a food' });
    await waitFor(() => expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(footer.getBoundingClientRect().top));
  },
};

export const SetTargetsWithKeyboard: Story = {
  args: { onInit: (db) => insertEntry(db, { day: localDay(), label: 'Oats', calories: 2150, protein: 60, carbs: 300, fat: 50 }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const oats = /^Oats, 2150 kilocalories, protein 60, carbs 300, fat 50 grams/;
    await userEvent.click(await canvas.findByRole('button', { name: 'Set targets' }));
    const calories = canvas.getByLabelText('Calorie target in kilocalories');
    await expect(calories).toHaveValue('');
    calories.focus();
    await userEvent.keyboard('0');
    await userEvent.tab();
    await userEvent.keyboard('100');
    await userEvent.click(canvas.getByRole('button', { name: 'Save targets' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter a number above 0, or leave it blank');
    await replace(calories, '2000');
    await expect(canvas.queryByRole('alert')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Save targets' }));
    await expect(await canvas.findByText('150 kcal over')).toBeVisible();
    await expect(canvas.getByText('40 g left')).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'Edit targets' }));
    await expect(canvas.getByLabelText('Calorie target in kilocalories')).toHaveValue('2000');
    await replace(canvas.getByLabelText('Calorie target in kilocalories'), '2500');
    await userEvent.clear(canvas.getByLabelText('Protein target in grams'));
    await userEvent.click(canvas.getByRole('button', { name: 'Save targets' }));
    await expect(await canvas.findByText('350 kcal left')).toBeVisible();
    await expect(canvas.queryByText(/of 100 g/)).toBeNull();
    await expect(canvas.getByRole('button', { name: oats })).toBeVisible();
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
  args: { onInit: (db) => restoreBackup(db, v2Backup as Backup) },
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
    await expect({ ...exported, exportedAt: v2Backup.exportedAt }).toEqual(v2Backup);
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
      [JSON.stringify({ ...v2Backup, version: 3 }), 'This backup was made by a newer version of the app (format 3). Update the app to restore it.'],
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

export const BackupRestoresTargets: Story = {
  args: { onInit: seedRiceToday },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No daily targets set. Intake is shown without a goal.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    await pickFile(canvas, JSON.stringify(v2Backup));
    await expect(await canvas.findByText('2 saved foods (1 archived) and 3 diary entries on 2 days, 2026-10-30 to 2026-10-31, plus 2 daily targets.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Replace all data' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Back to food log' }));
    await expect(await canvas.findByText('0 of 2000 kcal')).toBeVisible();
    await expect(canvas.getByText('2000 kcal left')).toBeVisible();
    await expect(canvas.getByText('100 g left')).toBeVisible();
  },
};

// Holds the restore's food inserts until the story releases them, so the restore stays in flight.
let releaseRestore = () => {};

export const BackupRestoreInProgressLocksNavigation: Story = {
  args: {
    onInit: async (db) => {
      await seedRiceToday(db);
      const gate = new Promise<void>((resolve) => (releaseRestore = resolve));
      const runAsync = db.runAsync;
      db.runAsync = async (sql, params) => {
        if (sql.startsWith('INSERT INTO foods (id,')) await gate;
        return runAsync(sql, params);
      };
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Settings' }));
    await pickFile(canvas, JSON.stringify(v1Backup));
    await userEvent.click(await canvas.findByRole('button', { name: 'Replace all data' }));

    await expect(await canvas.findByText('Restoring your backup. Keep the app open until it finishes.')).toBeVisible();
    for (const name of ['Cancel', 'Cancel restore', 'Restoring…']) {
      const button = canvas.getByRole('button', { name });
      await expect(button).toHaveAttribute('aria-disabled', 'true');
      button.click();
    }
    await expect(canvas.queryByText(/Restore cancelled/)).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Back to food log' })).toBeNull();

    releaseRestore();
    await expect(await canvas.findByText('Restored 2 saved foods (1 archived) and 3 diary entries on 2 days, 2026-10-30 to 2026-10-31.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Back to food log' }));
    await expect(await canvas.findByText('No entries for this day yet.')).toBeVisible();
  },
};
