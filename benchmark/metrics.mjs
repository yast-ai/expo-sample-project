export function summarize(samples, start, end) {
  const selected = samples.filter(s => s.time >= start && s.time <= end);
  if (!selected.length) return { durationSeconds: (end - start) / 1000 };
  const cpus = selected.map(s => s.cpu).filter(Number.isFinite);
  const max = key => Math.max(...selected.map(s => s[key]));
  return {
    durationSeconds: (end - start) / 1000,
    cpuAverage: cpus.length ? cpus.reduce((a, b) => a + b, 0) / cpus.length : null,
    cpuPeak: cpus.length ? Math.max(...cpus) : null,
    cpuSeries: selected.filter((_, i) => i % Math.max(1, Math.ceil(selected.length / 80)) === 0).map(s => s.cpu || 0),
    memoryPeakGiB: max('memoryUsed') / 2 ** 30,
    memoryMinAvailableGiB: Math.min(...selected.map(s => s.memoryAvailable)) / 2 ** 30,
    diskDeltaGiB: (max('diskUsed') - selected[0].diskUsed) / 2 ** 30,
    diskPeakGiB: max('diskUsed') / 2 ** 30,
    swapPeakMiB: max('swapUsed') / 2 ** 20,
    oom: max('oom') > selected[0].oom,
    sampleCount: selected.length,
  };
}

// A metrics writer may be midway through its final NDJSON append when polled.
export function parseSamples(text) {
  const lines = text.split('\n');
  return lines.flatMap((line, index) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line)]; }
    catch (error) {
      if (index === lines.length - 1 && !text.endsWith('\n')) return [];
      throw error;
    }
  });
}
