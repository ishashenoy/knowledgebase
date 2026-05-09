export function formatDate(value: string | null) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function shortText(value: string, length = 140) {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length).trim()}...`;
}
