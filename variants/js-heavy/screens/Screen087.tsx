import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-087-01", "module-087-02", "module-087-03", "module-087-04", "module-087-05", "module-087-06", "module-087-07", "module-087-08", "module-087-09", "module-087-10", "module-087-11", "module-087-12", "module-087-13", "module-087-14", "module-087-15", "module-087-16", "module-087-17", "module-087-18", "module-087-19", "module-087-20", "module-087-21", "module-087-22", "module-087-23", "module-087-24"];

export function Screen087() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 087</Text>
      <Text style={styles.detail}>Loaded 087: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
