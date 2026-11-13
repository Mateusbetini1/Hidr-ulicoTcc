// Conta pontos de código como o char_length do PostgreSQL em UTF-8.
export function characterCount(text: string) {
  return Array.from(text).length;
}
