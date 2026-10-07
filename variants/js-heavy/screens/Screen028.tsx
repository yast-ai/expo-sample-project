import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-028-01", "module-028-02", "module-028-03", "module-028-04", "module-028-05", "module-028-06", "module-028-07", "module-028-08", "module-028-09", "module-028-10", "module-028-11", "module-028-12", "module-028-13", "module-028-14", "module-028-15", "module-028-16", "module-028-17", "module-028-18", "module-028-19", "module-028-20", "module-028-21", "module-028-22", "module-028-23", "module-028-24"];

export function Screen028() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 028</Text>
      <Text style={styles.detail}>Loaded 028: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
