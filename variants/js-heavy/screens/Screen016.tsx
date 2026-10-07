import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-016-01", "module-016-02", "module-016-03", "module-016-04", "module-016-05", "module-016-06", "module-016-07", "module-016-08", "module-016-09", "module-016-10", "module-016-11", "module-016-12", "module-016-13", "module-016-14", "module-016-15", "module-016-16", "module-016-17", "module-016-18", "module-016-19", "module-016-20", "module-016-21", "module-016-22", "module-016-23", "module-016-24"];

export function Screen016() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 016</Text>
      <Text style={styles.detail}>Loaded 016: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
