export function simplifiedErrors(errors) {
  const result = {};
  for (const field in errors) {
    result[field] = errors[field].message;
  }
  return result;
}
