import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-018-01", "module-018-02", "module-018-03", "module-018-04", "module-018-05", "module-018-06", "module-018-07", "module-018-08", "module-018-09", "module-018-10", "module-018-11", "module-018-12", "module-018-13", "module-018-14", "module-018-15", "module-018-16", "module-018-17", "module-018-18", "module-018-19", "module-018-20", "module-018-21", "module-018-22", "module-018-23", "module-018-24"];

export function Screen018() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 018</Text>
      <Text style={styles.detail}>Loaded 018: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
