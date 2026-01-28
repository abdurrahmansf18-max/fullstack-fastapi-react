export function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
