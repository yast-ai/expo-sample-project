import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-051-01", "module-051-02", "module-051-03", "module-051-04", "module-051-05", "module-051-06", "module-051-07", "module-051-08", "module-051-09", "module-051-10", "module-051-11", "module-051-12", "module-051-13", "module-051-14", "module-051-15", "module-051-16", "module-051-17", "module-051-18", "module-051-19", "module-051-20", "module-051-21", "module-051-22", "module-051-23", "module-051-24"];

export function Screen051() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 051</Text>
      <Text style={styles.detail}>Loaded 051: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
