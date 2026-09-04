export const CHAT_BANNED_TERMS = [
  'kys',
  'kill yourself',
  'rape',
  'porn',
  'onlyfans',
  'nazi',
  'dox',
  'doxx',
  'scam link',
] as const;

export type ChatBannedTerm = (typeof CHAT_BANNED_TERMS)[number];

export type ContentFilterResult = {
  matchedTerm: ChatBannedTerm | null;
  ok: boolean;
};

export function normalizeContentFilterText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function checkChatContent(value: string): ContentFilterResult {
  const normalized = ` ${normalizeContentFilterText(value)} `;
  const matchedTerm =
    CHAT_BANNED_TERMS.find((term) =>
      normalized.includes(` ${normalizeContentFilterText(term)} `),
    ) ?? null;

  return {
    matchedTerm,
    ok: matchedTerm === null,
  };
}

export function getChatContentFilterMessage(value: string) {
  return checkChatContent(value).ok
    ? null
    : 'Remove objectionable language before sending.';
}
