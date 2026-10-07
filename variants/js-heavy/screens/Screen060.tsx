import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-060-01", "module-060-02", "module-060-03", "module-060-04", "module-060-05", "module-060-06", "module-060-07", "module-060-08", "module-060-09", "module-060-10", "module-060-11", "module-060-12", "module-060-13", "module-060-14", "module-060-15", "module-060-16", "module-060-17", "module-060-18", "module-060-19", "module-060-20", "module-060-21", "module-060-22", "module-060-23", "module-060-24"];

export function Screen060() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 060</Text>
      <Text style={styles.detail}>Loaded 060: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
