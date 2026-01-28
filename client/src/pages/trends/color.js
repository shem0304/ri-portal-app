// Shared deterministic vivid color, consistent with WordCloud.
// Uses HSL to keep colors distinguishable while remaining readable.
export function colorForWord(text) {
  const s = String(text || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 70%, 45%)`;
}
