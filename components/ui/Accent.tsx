/**
 * Display headings set one word in the italic (D49). The text is often Lody's own (a category or
 * program name, the story heading), so the word is picked by position: the last one by default.
 * The words stay in one text run for screen readers; <em> here is styling only.
 */
export function Accent({ text, word = -1 }: { text: string; word?: number }) {
  const words = text.trim().split(/\s+/);
  const index = ((word % words.length) + words.length) % words.length;
  return (
    <>
      {words.slice(0, index).join(" ")}
      {index > 0 && " "}
      <em>{words[index]}</em>
      {index < words.length - 1 && " "}
      {words.slice(index + 1).join(" ")}
    </>
  );
}
