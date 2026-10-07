import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-078-01", "module-078-02", "module-078-03", "module-078-04", "module-078-05", "module-078-06", "module-078-07", "module-078-08", "module-078-09", "module-078-10", "module-078-11", "module-078-12", "module-078-13", "module-078-14", "module-078-15", "module-078-16", "module-078-17", "module-078-18", "module-078-19", "module-078-20", "module-078-21", "module-078-22", "module-078-23", "module-078-24"];

export function Screen078() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 078</Text>
      <Text style={styles.detail}>Loaded 078: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
