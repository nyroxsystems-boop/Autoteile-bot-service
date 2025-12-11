export function cn(...classes: Array<string | false | null | undefined | Record<string, boolean>>): string {
  const out: string[] = [];
  classes.forEach((cls) => {
    if (!cls) return;
    if (typeof cls === 'string') {
      out.push(cls);
    } else if (typeof cls === 'object') {
      Object.entries(cls).forEach(([key, val]) => {
        if (val) out.push(key);
      });
    }
  });
  return out.join(' ');
}
