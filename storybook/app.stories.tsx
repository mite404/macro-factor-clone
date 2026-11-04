import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import App from '../src/App';
import { restoreBackup, type Backup } from '../src/features/backup/backup';
import v1Backup from '../src/features/backup/backup-v1.json';
import v2Backup from '../src/features/backup/backup-v2.json';
import v3Backup from '../src/features/backup/backup-v3.json';
import { insertEntry, localDay } from '../src/features/diary/diary';
import { insertFood } from '../src/features/foods/foods';
import { saveTargets } from '../src/features/goals/goals';
import { camera } from './camera';
import { deleteUsdaKey, saveUsdaKey } from '../src/features/lookup/key';
import nutellaReply from '../src/features/lookup/off-product-nutella.json';
import offMissReply from '../src/features/lookup/off-product-not-found.json';
import cheeriosReply from '../src/features/lookup/usda-search-cheerios.json';
import karsReply from '../src/features/lookup/usda-search-kars.json';
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

// "0070" predates check-digit validation; editing other fields must still save.
const yogurt = { name: 'Greek yogurt', basis: 'g', calories: 123, protein: 8, carbs: null, fat: null, serving: null, barcode: '0070' } as const;

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

export const ActiveTabKeepsDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Quick add' }));
    await userEvent.type(canvas.getByLabelText('Calories in kilocalories'), '250');
    await userEvent.click(canvas.getByRole('tab', { name: 'Quick Add' }));
    await expect(canvas.getByLabelText('Calories in kilocalories')).toHaveValue('250');
    await userEvent.click(canvas.getByRole('tab', { name: 'Barcode' }));
    await userEvent.type(await canvas.findByLabelText('Barcode digits'), '0070');
    await userEvent.click(canvas.getByRole('tab', { name: 'Barcode' }));
    await expect(canvas.getByLabelText('Barcode digits')).toHaveValue('0070');
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
  args: { onInit: (db) => restoreBackup(db, v3Backup as Backup) },
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
    await expect({ ...exported, exportedAt: v3Backup.exportedAt }).toEqual(v3Backup);
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
      [JSON.stringify({ ...v3Backup, version: 4 }), 'This backup was made by a newer version of the app (format 4). Update the app to restore it.'],
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

// The replies the next USDA and Open Food Facts lookups get, in order, and the URLs requested.
// Other requests pass through; an unexpected provider request fails the story.
type Reply = (signal?: AbortSignal | null) => Promise<Response>;
const hosts = { usda: 'https://api.nal.usda.gov/', off: 'https://world.openfoodfacts.org/' } as const;
let replies: Record<keyof typeof hosts, Reply[]> = { usda: [], off: [] };
const usdaCalls: string[] = [];
const offCalls: string[] = [];
const json = (body: unknown, status = 200): Reply => async () => new Response(JSON.stringify(body), { status });
const offMiss = json(offMissReply, 404);
const kars = karsReply.foods[0];
const cheerios = cheeriosReply.foods[0];

async function stubLookups(key: string | null, usda: Reply[], off: Reply[] = []) {
  await (key ? saveUsdaKey(key) : deleteUsdaKey());
  replies = { usda, off };
  usdaCalls.length = 0;
  offCalls.length = 0;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(input);
    const host = url.startsWith(hosts.usda) ? 'usda' : url.startsWith(hosts.off) ? 'off' : null;
    if (!host) return original(input, init);
    (host === 'usda' ? usdaCalls : offCalls).push(url);
    const reply = replies[host].shift();
    if (!reply) throw new Error(`unexpected ${host} request ${url}`);
    return reply(init?.signal);
  };
}

async function lookUp(canvas: ReturnType<typeof within>, code: string) {
  const input = await canvas.findByLabelText('Barcode digits');
  await replace(input, code);
  await userEvent.click(canvas.getByRole('button', { name: 'Look up barcode' }));
}

const savedKars = { name: "NUT 'N BERRY MIX", basis: 'g', calories: 500, protein: 14.3, carbs: 42.9, fat: 32.1, serving: { name: '1 ONZ', amount: 28 }, barcode: '077034085228' } as const;
const karsSource = { brand: "KAR'S", source: { id: 'fdc:2105222', name: 'USDA FoodData Central', retrievedOn: '2026-11-03' } };

export const BarcodeSavedFoodOffline: Story = {
  args: {
    onInit: async (db) => {
      await insertFood(db, savedKars, karsSource);
      await stubLookups(null, []);
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await expect(await canvas.findByText('Scan or type a barcode')).toBeVisible();
    await lookUp(canvas, '0 0770 34085 228');
    await expect(await canvas.findByText('In your saved foods')).toBeVisible();
    await expect(canvas.getByText('Found on this phone, so nothing was looked up online.')).toBeVisible();
    await expect([...usdaCalls, ...offCalls]).toEqual([]);
    await userEvent.click(canvas.getByRole('button', { name: "NUT 'N BERRY MIX, KAR'S, 500 kilocalories per 100 g" }));
    await expect(await canvas.findByText('Edits change only this saved copy, not past diary entries.')).toBeVisible();
    await expect(canvas.getByText('USDA FoodData Central')).toBeVisible();
    await expect(canvas.getByText('2026-11-03')).toBeVisible();
    await expect(canvas.getByText('077034085228')).toBeVisible();
  },
};

export const BarcodeUsdaReviewSaveAndRepeat: Story = {
  args: { onInit: () => stubLookups('storybook-fake-key', [json({ foods: [cheerios, kars] })]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Search for a food' }));
    await userEvent.click(await canvas.findByRole('tab', { name: 'Barcode' }));
    // Keyboard only: the field has focus, digits are typed, and Enter looks the code up.
    const input = await canvas.findByLabelText('Barcode digits');
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.keyboard('0077034085228{Enter}');
    await expect(await canvas.findByText('USDA FoodData Central')).toBeVisible();
    await expect(canvas.queryByText(/Cheerios/)).toBeNull();
    await expect(new URL(usdaCalls[0]).searchParams.get('query')).toBe('077034085228 0077034085228 00077034085228');
    await expect(usdaCalls[0]).not.toContain('storybook-fake-key');

    await userEvent.click(canvas.getByRole('button', { name: "NUT 'N BERRY MIX, KAR'S, 500 kilocalories per 100 g" }));
    await expect(await canvas.findByText('Nothing is saved until you tap Save food.')).toBeVisible();
    await expect(canvas.getByText('Per 100 g: 500 kcal · P 14.3 · C 42.9 · F 32.1 g')).toBeVisible();
    await expect(canvas.getByText('1 ONZ (28 g)')).toBeVisible();
    await expect(canvas.getByText('2105222, published 2021-10-28')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Back to barcode results' }));
    await userEvent.click(await canvas.findByRole('button', { name: "NUT 'N BERRY MIX, KAR'S, 500 kilocalories per 100 g" }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Save food' }));

    await userEvent.type(await canvas.findByLabelText('Amount in grams'), '28');
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));
    await expect(await canvas.findByRole('button', { name: /^NUT 'N BERRY MIX, 28 g, 140 kilocalories/ })).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'Look up a barcode' }));
    await lookUp(canvas, '077034085228');
    await expect(await canvas.findByText('In your saved foods')).toBeVisible();
    await expect(usdaCalls).toHaveLength(1);
    await expect(offCalls).toEqual([]);
  },
};

export const BarcodeMultipleRecords: Story = {
  args: {
    onInit: () => stubLookups('storybook-fake-key', [json({ foods: [
      kars,
      { ...kars, fdcId: 999, gtinUpc: '00077034085228', publishedDate: '2024-03-01', description: "NUT 'N BERRY MIX, NEW RECIPE" },
      { ...kars, fdcId: 7, foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: -5 }] },
    ] })]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await lookUp(canvas, '077034085228');
    await expect(await canvas.findByText('2 records have exactly this barcode, such as older and newer labels. Compare them and save the one on your package.')).toBeVisible();
    await expect(canvas.getByText('USDA record 2105222, published 2021-10-28')).toBeVisible();
    await expect(canvas.getByText('USDA record 999, published 2024-03-01')).toBeVisible();
    await expect(canvas.getByText("1 more record was left out because the nutrition can't be used.")).toBeVisible();
  },
};

export const BarcodeLookupErrors: Story = {
  args: {
    onInit: () => stubLookups(null, [
      json({ error: { code: 'OVER_RATE_LIMIT' } }, 429),
      async () => { throw new TypeError('Failed to fetch'); },
      json({ error: { code: 'API_KEY_INVALID' } }, 403),
      json({ totalHits: 0, foods: [] }),
      json(cheeriosReply),
    ], [offMiss, offMiss]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await lookUp(canvas, '077034085229');
    await expect(await canvas.findByRole('alert')).toHaveTextContent("The last digit doesn't match. Check each digit");
    await lookUp(canvas, '77034085228');
    await expect(await canvas.findByRole('alert')).toHaveTextContent('A barcode has 8, 12, 13, or 14 digits');

    // With no key, Open Food Facts is asked directly.
    await lookUp(canvas, '077034085228');
    await expect(await canvas.findByText('Not in your saved foods')).toBeVisible();
    await expect(canvas.getByText('Not in Open Food Facts')).toBeVisible();
    await expect([usdaCalls.length, offCalls.length]).toEqual([0, 1]);
    await userEvent.click(canvas.getByRole('button', { name: 'Open Settings' }));
    const key = await canvas.findByLabelText('USDA API key');
    await userEvent.type(key, 'storybook-fake-key');
    await userEvent.click(canvas.getByRole('button', { name: 'Save USDA key' }));
    await expect(await canvas.findByText('Your USDA key is saved')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Back to barcode lookup' }));

    const outcomes: [string, string][] = [
      ["USDA's hourly limit is used up", 'Try again'],
      ["Couldn't reach USDA", 'Try again'],
      ['USDA rejected your key', 'Open Settings'],
    ];
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up barcode' }));
    for (const [title, action] of outcomes) {
      await expect(await canvas.findByText(title)).toBeVisible();
      await expect(canvas.getByRole('button', { name: 'Create food' })).toBeVisible();
      // A USDA failure is not a miss: Open Food Facts waits to be asked.
      await expect(canvas.getByRole('button', { name: 'Try Open Food Facts' })).toBeVisible();
      if (action === 'Try again') await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    }
    await expect(offCalls).toHaveLength(1);
    await lookUp(canvas, '077034085228');
    await expect(await canvas.findByText('No USDA match')).toBeVisible();
    await expect(canvas.getByText('Open Food Facts has no product with this barcode either. Create the food from its label; the barcode is filled in.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Create food' }));
    await expect(await canvas.findByLabelText('Barcode, optional')).toHaveValue('077034085228');
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await lookUp(canvas, '016000275287');
    await expect(await canvas.findByText("USDA's nutrition can't be used")).toBeVisible();
    await expect(usdaCalls).toHaveLength(5);
    await expect(offCalls).toHaveLength(2);
  },
};

export const BarcodeTimeoutRecovers: Story = {
  args: {
    onInit: () => stubLookups('storybook-fake-key', [
      (signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
      json({ foods: [kars] }),
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await lookUp(canvas, '077034085228');
    await expect(await canvas.findByText('Checking saved foods, then USDA and Open Food Facts…')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Look up barcode' })).toHaveAttribute('aria-disabled', 'true');
    await expect(await canvas.findByText("USDA didn't answer", {}, { timeout: 12_000 })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(await canvas.findByText('One record has exactly this barcode. Open it to check the nutrition before saving.')).toBeVisible();
  },
};

export const UsdaKeySettings: Story = {
  args: { onInit: () => stubLookups(null, []) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Settings' }));
    await expect(await canvas.findByText('Add your USDA key')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Save USDA key' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Paste the key from your api.data.gov email');
    const key = canvas.getByLabelText('USDA API key');
    await expect(key).toHaveAttribute('type', 'password');
    await userEvent.type(key, 'storybook fake key');
    await userEvent.click(canvas.getByRole('button', { name: 'Save USDA key' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent("That isn't a key. Copy it again, without spaces");
    await replace(key, 'storybook-fake-key');
    await userEvent.click(canvas.getByRole('button', { name: 'Save USDA key' }));
    await expect(await canvas.findByText('Your USDA key is saved')).toBeVisible();
    await expect(canvas.getByLabelText('USDA API key')).toHaveValue('');
    await expect(canvasElement.textContent).not.toContain('storybook-fake-key');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove USDA key' }));
    await expect(await canvas.findByText('Key removed. Barcode lookup still finds your saved foods.')).toBeVisible();
    await expect(canvas.getByText('Add your USDA key')).toBeVisible();
  },
};

export const BarcodeLargeText: Story = {
  args: { onInit: () => stubLookups('storybook-fake-key', [json({ foods: [kars] })]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await lookUp(canvas, '077034085228');
    await userEvent.click(await canvas.findByRole('button', { name: "NUT 'N BERRY MIX, KAR'S, 500 kilocalories per 100 g" }));
    await expect(await canvas.findByText('Nothing is saved until you tap Save food.')).toBeVisible();
    enlargeText(canvasElement);
    // The shared macro summary wraps into fewer columns rather than cutting figures off.
    await waitFor(() => {
      for (const value of ['500', '14.3', '32.1', '42.9']) {
        const el = canvas.getByText(value);
        expect(el.scrollWidth, `${value} is cut off`).toBeLessThanOrEqual(el.clientWidth);
      }
    });
    const save = canvas.getByRole('button', { name: 'Save food' });
    const retrieved = canvas.getByText('Retrieved');
    retrieved.scrollIntoView({ block: 'end' });
    await waitFor(() => expect(retrieved.getBoundingClientRect().bottom).toBeLessThanOrEqual(save.getBoundingClientRect().top));
  },
};

const nutellaRow = 'Nutella, Nutella, Ferrero, 539 kilocalories per 100 g';
// Records links the app opens instead of leaving the story.
function captureOpens() {
  const opened: string[] = [];
  window.open = (url) => {
    opened.push(String(url));
    return null;
  };
  return opened;
}

export const BarcodeOffFallbackSaveOffline: Story = {
  args: { onInit: () => stubLookups('storybook-fake-key', [json({ totalHits: 0, foods: [] })], [json(nutellaReply)]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const opened = captureOpens();
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await lookUp(canvas, '3017620422003');
    await expect(await canvas.findByText('No USDA match. Open Food Facts has one product with exactly this barcode. Open it to check the nutrition before saving.')).toBeVisible();
    await expect(canvas.getByText('Open Food Facts product 3017620422003')).toBeVisible();
    await expect(new URL(offCalls[0]).pathname).toBe('/api/v3.5/product/3017620422003');

    await userEvent.click(canvas.getByRole('button', { name: nutellaRow }));
    await expect(await canvas.findByText('Nothing is saved until you tap Save food.')).toBeVisible();
    await expect(canvas.getByText('Per 100 g: 539 kcal · P 6.3 · C 57.5 · F 30.9 g')).toBeVisible();
    await expect(canvas.getByText('Open Food Facts')).toBeVisible();
    await userEvent.click(canvas.getByRole('link', { name: 'Open Database License' }));
    await expect(opened).toEqual(['https://opendatacommons.org/licenses/odbl/1.0/']);
    await userEvent.click(canvas.getByRole('button', { name: 'Save food' }));

    // Saved: the food detail keeps its source and license, and logs with no network.
    await expect(await canvas.findByText('Edits change only this saved copy, not past diary entries.')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open Database License' })).toBeVisible();
    await userEvent.type(canvas.getByLabelText('Amount in grams'), '20');
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));
    await expect(await canvas.findByRole('button', { name: /^Nutella, 20 g, 107.8 kilocalories/ })).toBeVisible();
    window.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await userEvent.click(canvas.getByRole('button', { name: 'Look up a barcode' }));
    await lookUp(canvas, '03017620422003');
    await expect(await canvas.findByText('In your saved foods')).toBeVisible();
    await expect([usdaCalls.length, offCalls.length]).toEqual([1, 1]);
  },
};

// The camera reports a held barcode three times; only the first starts a lookup.
export const BarcodeScanOnceAndRescan: Story = {
  args: {
    onInit: async () => {
      Object.assign(camera, { status: 'undetermined', answer: 'granted', requests: 0, scans: Array(3).fill('3017620422003'), mountError: '' });
      await stubLookups(null, [], [json(nutellaReply), json(nutellaReply)]);
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await expect(camera.requests).toBe(0);
    await userEvent.click(await canvas.findByRole('button', { name: 'Scan a barcode' }));
    await expect(await canvas.findByRole('button', { name: nutellaRow })).toBeVisible();
    await expect(camera.requests).toBe(1);
    await expect(offCalls).toHaveLength(1);
    await expect(canvas.getByLabelText('Barcode digits')).toHaveValue('3017620422003');

    await userEvent.click(canvas.getByRole('button', { name: 'Scan a barcode' }));
    await expect(await canvas.findByRole('button', { name: nutellaRow })).toBeVisible();
    await expect([camera.requests, offCalls.length]).toEqual([1, 2]);
  },
};

// Denied: Settings is offered, and a typed unknown product still reaches manual creation.
export const BarcodeScanDeniedTypeUnknown: Story = {
  args: {
    onInit: async () => {
      Object.assign(camera, { status: 'undetermined', answer: 'denied', requests: 0, scans: [], mountError: '' });
      await stubLookups(null, [], [offMiss]);
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Scan a barcode' }));
    await expect(await canvas.findByText('Camera access is off')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Open Settings' })).toBeVisible();
    await lookUp(canvas, '0000000000017');
    await expect(await canvas.findByText('Not in Open Food Facts')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Create food' }));
    await expect(await canvas.findByDisplayValue('0000000000017')).toBeVisible();
  },
};

// The iOS prompt is still open: the scanner waits behind it instead of reporting access off.
export const BarcodeScanPromptOpen: Story = {
  args: { onInit: async () => { Object.assign(camera, { status: 'undetermined', answer: 'undetermined', requests: 0, scans: [], mountError: '' }); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Scan a barcode' }));
    await waitFor(() => expect(camera.requests).toBe(1));
    await expect(canvas.getByText(/Hold the barcode inside the square/)).toBeVisible();
    await expect(canvas.queryByText('Camera access is off')).toBeNull();
  },
};

// A media reset the camera recovered from keeps it open; any other mount error reports a failed start.
export const BarcodeScanMountErrors: Story = {
  args: { onInit: async () => { Object.assign(camera, { status: 'granted', answer: 'granted', requests: 0, scans: [], mountError: 'Camera session was reset' }); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Scan a barcode' }));
    await expect(await canvas.findByText(/Hold the barcode inside the square/)).toBeVisible();
    await expect(canvas.queryByText("The camera couldn't start")).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    camera.mountError = 'Camera could not be started - busy';
    await userEvent.click(canvas.getByRole('button', { name: 'Scan a barcode' }));
    await expect(await canvas.findByText("The camera couldn't start")).toBeVisible();
  },
};

export const BarcodeUsdaLimitOffersOff: Story = {
  args: {
    onInit: () => stubLookups('storybook-fake-key', [json({ error: { code: 'OVER_RATE_LIMIT' } }, 429)],
      [json({}, 503), json(nutellaReply)]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await lookUp(canvas, '3017620422003');
    await expect(await canvas.findByText("USDA's hourly limit is used up")).toBeVisible();
    await expect(offCalls).toEqual([]);
    await userEvent.click(canvas.getByRole('button', { name: 'Try Open Food Facts' }));
    await expect(await canvas.findByText('Open Food Facts is busy')).toBeVisible();
    await expect(canvas.getByText("USDA's hourly limit is used up")).toBeVisible();
    // Try again repeats only the Open Food Facts request; USDA is not asked again.
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(await canvas.findByText("USDA's hourly limit is used up. Open Food Facts has one product with exactly this barcode. Open it to check the nutrition before saving.")).toBeVisible();
    await expect([usdaCalls.length, offCalls.length]).toEqual([1, 2]);
  },
};

// Nutella with no protein or fat in its label record: both stay unknown.
const partialNutella = (() => {
  const { proteins: _, fat: __, ...nutrients } = nutellaReply.product.nutrition.aggregated_set.nutrients;
  return { ...nutellaReply, product: { ...nutellaReply.product, nutrition: { aggregated_set: { ...nutellaReply.product.nutrition.aggregated_set, nutrients } } } };
})();

export const BarcodeOffLargeText: Story = {
  args: { onInit: () => stubLookups(null, [], [json(partialNutella)]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Look up a barcode' }));
    await lookUp(canvas, '3017620422003');
    await expect(await canvas.findByText('Not in your saved foods. Open Food Facts has one product with exactly this barcode. Open it to check the nutrition before saving.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: nutellaRow }));
    await expect(await canvas.findByText('Open Food Facts lists no protein or fat. It stays unknown in your log, not 0.')).toBeVisible();
    await expect(canvas.getByText('Per 100 g: 539 kcal · P ? · C 57.5 · F ? g')).toBeVisible();
    enlargeText(canvasElement);
    await waitFor(() => {
      for (const text of ['539', '57.5', 'Open Database License', '3017620422003']) {
        const el = canvas.getAllByText(text)[0];
        expect(el.scrollWidth, `${text} is cut off`).toBeLessThanOrEqual(el.clientWidth);
      }
    });
    const save = canvas.getByRole('button', { name: 'Save food' });
    const license = canvas.getByRole('link', { name: 'Open Database License' });
    license.scrollIntoView({ block: 'end' });
    await waitFor(() => expect(license.getBoundingClientRect().bottom).toBeLessThanOrEqual(save.getBoundingClientRect().top));
  },
};
