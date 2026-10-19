export function reconstructPage(items) {
  const groups = [];
  for (const item of items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const y = item.transform[5],
      group = groups.find((g) => Math.abs(g.y - y) <= 2);
    if (group) group.items.push(item);
    else groups.push({ y, items: [item] });
  }
  const lines = groups
    .sort((a, b) => b.y - a.y)
    .map((group, index) => {
      const ordered = group.items.sort(
        (a, b) => a.transform[4] - b.transform[4],
      );
      let line = "",
        previous = null;
      for (const item of ordered) {
        const gap = previous
          ? item.transform[4] - (previous.transform[4] + previous.width)
          : 0;
        line +=
          (previous && gap > Math.max(1, Math.abs(item.transform[0]) * 0.12)
            ? gap > 35
              ? "\t"
              : " "
            : "") + item.str;
        previous = item;
      }
      return {
        text: line.trim(),
        line: index + 1,
        bounds: {
          x: ordered[0].transform[4],
          y: group.y,
          width:
            Math.max(...ordered.map((i) => i.transform[4] + i.width)) -
            ordered[0].transform[4],
          height: Math.max(...ordered.map((i) => Math.abs(i.transform[3]))),
        },
        segments: ordered.map((i) => ({
          text: i.str,
          x: i.transform[4],
          y: i.transform[5],
          width: i.width,
          height: Math.abs(i.transform[3]),
        })),
      };
    });
  return { text: lines.map((l) => l.text).join("\n"), lines };
}
export function reconstructLines(items) {
  return reconstructPage(items).text.replace(/\t/g, " ");
}
