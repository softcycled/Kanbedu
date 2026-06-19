// Shared group-name matching for the Monitor/Integrity "Search groups…" boxes.
// Splits text into tokens and treats numbers as equal regardless of zero-padding,
// so a search for "04" can suggest a group literally named "Group 4" even though
// neither string is a substring of the other.

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);
}

function numericKey(token: string): string | null {
  return /^\d+$/.test(token) ? String(parseInt(token, 10)) : null;
}

function tokenContains(nameToken: string, queryToken: string): boolean {
  return nameToken.includes(queryToken);
}

function tokenNumericMatch(nameToken: string, queryToken: string): boolean {
  const nn = numericKey(nameToken);
  const qn = numericKey(queryToken);
  return nn !== null && qn !== null && nn === qn;
}

// Direct match used for the actual filtered results — plain substring per token,
// same behavior as before this feature existed.
export function matchesGroupName(name: string, query: string): boolean {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return true;
  const nameTokens = tokenize(name);
  return queryTokens.every((qt) => nameTokens.some((nt) => tokenContains(nt, qt)));
}

// Best "Did you mean…" candidate: a name that doesn't directly match (so it's not
// already in the visible results) but whose tokens are numerically equivalent to
// the query's tokens once zero-padding is normalized away.
export function findGroupSuggestion(
  names: string[],
  query: string,
  excludeNames: ReadonlySet<string>
): string | null {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return null;
  for (const name of names) {
    if (excludeNames.has(name)) continue;
    const nameTokens = tokenize(name);
    const allMatch = queryTokens.every((qt) =>
      nameTokens.some((nt) => tokenContains(nt, qt) || tokenNumericMatch(nt, qt))
    );
    if (allMatch) return name;
  }
  return null;
}
