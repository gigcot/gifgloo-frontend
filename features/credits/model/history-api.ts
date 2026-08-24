import { API_BASE } from "@/shared/lib/api-base";

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CreditLotHistoryItem = {
  lot_id: string;
  payment_id: string;
  granted_uses: number;
  remaining_uses: number;
  expires_at: string;
  expired: boolean;
  created_at: string;
  order_id: string;
  payment_amount: number;
  currency: string;
  payment_status: string;
  approved_at: string | null;
  canceled_at: string | null;
};

export type CreditTransactionHistoryItem = {
  transaction_id: string;
  transaction_type: "CHARGE" | "DEDUCT" | "REFUND";
  signed_amount: number;
  uses: number;
  source_type: "PAYMENT" | "ADMIN" | "COMPOSITION" | "LOT" | null;
  source_id: string | null;
  credit_lot_id: string | null;
  reason: string | null;
  balance_after_uses: number | null;
  created_at: string;
};

export type HistoryPage<T> = {
  items: T[];
  has_more: boolean;
  next_cursor: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePage<T>(data: unknown, parseItem: (item: unknown) => T): HistoryPage<T> {
  if (
    !isRecord(data)
    || !Array.isArray(data.items)
    || typeof data.has_more !== "boolean"
    || (data.next_cursor !== null && typeof data.next_cursor !== "string")
  ) {
    throw new Error("내역 응답이 올바르지 않습니다");
  }
  return {
    items: data.items.map(parseItem),
    has_more: data.has_more,
    next_cursor: data.next_cursor,
  };
}

function parseLot(item: unknown): CreditLotHistoryItem {
  if (
    !isRecord(item)
    || typeof item.lot_id !== "string"
    || typeof item.payment_id !== "string"
    || typeof item.granted_uses !== "number"
    || typeof item.remaining_uses !== "number"
    || typeof item.expires_at !== "string"
    || typeof item.expired !== "boolean"
    || typeof item.created_at !== "string"
    || typeof item.order_id !== "string"
    || typeof item.payment_amount !== "number"
    || typeof item.currency !== "string"
    || typeof item.payment_status !== "string"
    || (item.approved_at !== null && typeof item.approved_at !== "string")
    || (item.canceled_at !== null && typeof item.canceled_at !== "string")
  ) {
    throw new Error("구매 내역 응답이 올바르지 않습니다");
  }
  return item as CreditLotHistoryItem;
}

function parseTransaction(item: unknown): CreditTransactionHistoryItem {
  if (
    !isRecord(item)
    || typeof item.transaction_id !== "string"
    || typeof item.transaction_type !== "string"
    || typeof item.signed_amount !== "number"
    || typeof item.uses !== "number"
    || (item.source_type !== null && typeof item.source_type !== "string")
    || (item.source_id !== null && typeof item.source_id !== "string")
    || (item.credit_lot_id !== null && typeof item.credit_lot_id !== "string")
    || (item.reason !== null && typeof item.reason !== "string")
    || (item.balance_after_uses !== null && typeof item.balance_after_uses !== "number")
    || typeof item.created_at !== "string"
  ) {
    throw new Error("이용 내역 응답이 올바르지 않습니다");
  }
  return item as CreditTransactionHistoryItem;
}

async function fetchPage<T>(
  authFetch: AuthFetch,
  path: string,
  cursor: string | null,
  parseItem: (item: unknown) => T,
): Promise<HistoryPage<T>> {
  const url = new URL(`${API_BASE}${path}`);
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await authFetch(url);
  if (!response.ok) throw new Error("이용권 내역을 불러오지 못했습니다");
  return parsePage(await response.json(), parseItem);
}

export function fetchCreditLots(
  authFetch: AuthFetch,
  cursor: string | null = null,
): Promise<HistoryPage<CreditLotHistoryItem>> {
  return fetchPage(authFetch, "/credits/lots", cursor, parseLot);
}

export function fetchCreditTransactions(
  authFetch: AuthFetch,
  cursor: string | null = null,
): Promise<HistoryPage<CreditTransactionHistoryItem>> {
  return fetchPage(authFetch, "/credits/history", cursor, parseTransaction);
}
