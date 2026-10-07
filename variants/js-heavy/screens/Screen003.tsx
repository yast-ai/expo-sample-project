import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-003-01", "module-003-02", "module-003-03", "module-003-04", "module-003-05", "module-003-06", "module-003-07", "module-003-08", "module-003-09", "module-003-10", "module-003-11", "module-003-12", "module-003-13", "module-003-14", "module-003-15", "module-003-16", "module-003-17", "module-003-18", "module-003-19", "module-003-20", "module-003-21", "module-003-22", "module-003-23", "module-003-24"];

export function Screen003() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 003</Text>
      <Text style={styles.detail}>Loaded 003: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
