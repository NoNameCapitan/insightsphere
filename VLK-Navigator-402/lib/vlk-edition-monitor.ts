function editionToNumber(edition: string) {
  const [day, month, year] = edition.split(".").map(Number);
  return year * 10_000 + month * 100 + day;
}

export function detectOfficialEdition(html: string) {
  const candidates = [
    ...[...html.matchAll(/Редакц(?:ія|iя)\s+від\s+(\d{2}\.\d{2}\.\d{4})/giu)].map(
      (match) => match[1],
    ),
    ...[...html.matchAll(/\/ed(\d{4})(\d{2})(\d{2})/gu)].map(
      (match) => `${match[3]}.${match[2]}.${match[1]}`,
    ),
  ];

  return [...new Set(candidates)].sort(
    (left, right) => editionToNumber(right) - editionToNumber(left),
  )[0];
}
