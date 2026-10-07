import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-012-01", "module-012-02", "module-012-03", "module-012-04", "module-012-05", "module-012-06", "module-012-07", "module-012-08", "module-012-09", "module-012-10", "module-012-11", "module-012-12", "module-012-13", "module-012-14", "module-012-15", "module-012-16", "module-012-17", "module-012-18", "module-012-19", "module-012-20", "module-012-21", "module-012-22", "module-012-23", "module-012-24"];

export function Screen012() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 012</Text>
      <Text style={styles.detail}>Loaded 012: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
