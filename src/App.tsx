import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import DiaryScreen from './features/diary/DiaryScreen';
import { migrate } from './storage/migrations';

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#f2f2f7' } });

/** The app entry screen: opens and migrates the local database, then shows the diary. */
export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <SQLiteProvider databaseName="nutrition.db" onInit={migrate}>
          <DiaryScreen />
        </SQLiteProvider>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
