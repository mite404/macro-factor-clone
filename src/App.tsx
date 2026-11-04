import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Diary from './features/diary/Diary';
import { migrate, type Db } from './storage/migrations';

/**
 * The app entry screen: opens and migrates the local database, then shows the diary.
 * @param onInit Runs after migration, before the diary loads. Stories use it to seed data.
 */
export default function App({ onInit }: { onInit?: (db: Db) => Promise<void> }) {
  return (
    <SafeAreaProvider>
      <SQLiteProvider
        databaseName="nutrition.db"
        onInit={async (db) => {
          await migrate(db);
          await onInit?.(db);
        }}
      >
        <Diary />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
