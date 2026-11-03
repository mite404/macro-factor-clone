import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BodyMetrics, Dashboard, Trend } from './AnalyticsScreens';
import { DeviceFrame } from '../src/ui';
import { ChooseMode, ProgramUpdate, RecipeBuilder, Strategy, TimelineSettings } from './ProgramScreens';

const wp = 'https://macrofactor.com/wp-content/uploads/';
const help = 'https://staticfiles.gleap.io/ghelparticle/';
const catalog = {
  dashboard: { title: 'Weekly nutrition', date: '2026 press kit · light',
    image: wp + '2026/01/Frame-34.png', render: () => <Dashboard /> },
  daily: { title: 'Daily nutrition', date: '2024 dashboard release · historical · dark',
    image: wp + '2024/11/image4.png', render: () => <Dashboard daily /> },
  strategy: { title: 'Strategy', date: '2026 press kit · dark',
    image: wp + '2026/01/Frame.png', render: () => <Strategy /> },
  update: { title: 'Program update', date: '2026 product page · foreground phone · light',
    image: wp + '2026/09/MF-2-phone-light.png', render: () => <ProgramUpdate /> },
  program: { title: 'Choose a program', date: 'Help center · capture undated · light',
    image: help + 'gpi9O7UWJUnPVlJBph30IRIQa9LdRsCUnCV14GUqkmVxikzQZtlrJIuJfH68dlYNVqbsiz2u7mt.png', render: () => <ChooseMode /> },
  recipeMethod: { title: 'Choose recipe method', date: 'September 2026 annual report · left screen · light',
    image: wp + '2026/09/Recipe-scaled.png', render: () => <ChooseMode recipe /> },
  recipe: { title: 'Build a recipe', date: 'September 2026 annual report · right screen · light',
    image: wp + '2026/09/Recipe-scaled.png', render: () => <RecipeBuilder /> },
  expenditure: { title: 'Expenditure', date: '2026 press kit · light',
    image: wp + '2026/01/Frame-35.png', render: () => <Trend /> },
  weight: { title: 'Weight trend', date: '2026 product page · right phone · dark',
    image: wp + '2026/09/MF-3-phone-dark.png', render: () => <Trend weight /> },
  timelineSettings: { title: 'Timeline settings', date: 'Help center · capture undated · light',
    image: help + 'qcQ4Vurx4LxRkRwOHg4Y5h1Qo4G6XXnB4DLm4kVoVGi7mUSTHIpTiXE892cFXQQ7SlZKVvX9vJs.png', render: () => <TimelineSettings /> },
  metrics: { title: 'Body metrics', date: '2024 dashboard release · historical · light',
    image: wp + '2024/11/image9.png', render: () => <BodyMetrics /> },
};

function ReferenceStudy({ screen }: { screen: keyof typeof catalog }) {
  const reference = catalog[screen];
  const [compare, setCompare] = useState(false);
  return <div style={{ padding: '24px 0', background: '#edeef0', minHeight: '100vh', boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#151515' }}>
    <header style={{ maxWidth: 1040, margin: '0 auto 24px', padding: '0 16px', display: 'flex', flexWrap: 'wrap',
      alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <div><h1 style={{ fontSize: 20, margin: '0 0 6px', letterSpacing: '-0.4px' }}>{reference.title}</h1>
        <div style={{ fontSize: 12, color: '#5b5b61' }}>{reference.date}</div></div>
      <a href={reference.image} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#303037' }}>Open original reference ↗</a>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, minHeight: 44 }}>
        <input type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)} />
        Compare source
      </label>
    </header>
    <main style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 32 }}>
      <DeviceFrame.Provider value>{reference.render()}</DeviceFrame.Provider>
      {compare ? <figure style={{ margin: 0, width: 560, maxWidth: '100%' }}>
        <img src={reference.image} alt={`MacroFactor source reference for ${reference.title}`}
          style={{ width: '100%', maxHeight: 844, objectFit: 'contain' }} />
        <figcaption style={{ fontSize: 12, marginTop: 12 }}>Original MacroFactor artwork, loaded from its public source.</figcaption>
      </figure> : null}
    </main>
    <footer style={{ maxWidth: 700, padding: '0 16px', margin: '24px auto 0', fontSize: 12, lineHeight: 1.6, color: '#5b5b61' }}>
      Design reference with fixture data, not a working feature. Its feature is not built yet. It uses the
      app's component kit; navigation and coaching actions are disabled and the numbers are illustrative.
      Compare source shows the original artwork alongside the reconstruction.
    </footer>
  </div>;
}

const meta = {
  title: 'Design references',
  component: ReferenceStudy,
  args: { screen: 'dashboard' },
} satisfies Meta<typeof ReferenceStudy>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WeeklyDashboard: Story = { args: { screen: 'dashboard' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Remaining' }));
    await expect(canvas.getByText('−124')).toBeVisible();
    await userEvent.click(canvas.getByRole('radio', { name: 'Consumed' }));
    await expect(canvas.getByText('1923 ♨')).toBeVisible();
  } };
export const DailyDashboardHistorical: Story = { args: { screen: 'daily' } };
export const StrategyCheckIn: Story = { args: { screen: 'strategy' } };
export const ProgramChanges: Story = { args: { screen: 'update' } };
export const ProgramStyle: Story = { args: { screen: 'program' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Manual' }));
    await expect(canvas.getByRole('radio', { name: 'Manual' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'Coached' })).not.toBeChecked();
    await userEvent.click(canvas.getByRole('radio', { name: 'Coached' }));
  } };
export const RecipeMethod: Story = { args: { screen: 'recipeMethod' } };
export const RecipeIngredients: Story = { args: { screen: 'recipe' } };
export const ExpenditureChart: Story = { args: { screen: 'expenditure' } };
export const WeightTrend: Story = { args: { screen: 'weight' } };
export const FoodLogSettings: Story = { args: { screen: 'timelineSettings' } };
export const BodyMetricsHistorical: Story = { args: { screen: 'metrics' } };
