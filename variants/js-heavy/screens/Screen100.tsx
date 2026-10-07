import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-100-01", "module-100-02", "module-100-03", "module-100-04", "module-100-05", "module-100-06", "module-100-07", "module-100-08", "module-100-09", "module-100-10", "module-100-11", "module-100-12", "module-100-13", "module-100-14", "module-100-15", "module-100-16", "module-100-17", "module-100-18", "module-100-19", "module-100-20", "module-100-21", "module-100-22", "module-100-23", "module-100-24"];

export function Screen100() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 100</Text>
      <Text style={styles.detail}>Loaded 100: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
