export const formatDateOnly = (value) => {
  if (!value) return "";

  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [, year, month, day] = match;
    return `${month}/${day}/${year}`;
  }

  return new Date(value).toLocaleDateString();
};
