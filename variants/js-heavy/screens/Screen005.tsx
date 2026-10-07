import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-005-01", "module-005-02", "module-005-03", "module-005-04", "module-005-05", "module-005-06", "module-005-07", "module-005-08", "module-005-09", "module-005-10", "module-005-11", "module-005-12", "module-005-13", "module-005-14", "module-005-15", "module-005-16", "module-005-17", "module-005-18", "module-005-19", "module-005-20", "module-005-21", "module-005-22", "module-005-23", "module-005-24"];

export function Screen005() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 005</Text>
      <Text style={styles.detail}>Loaded 005: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
