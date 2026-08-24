"use client";

import { useEffect, useState } from "react";
import {
  fetchCreditBalance,
  type PassBalance,
} from "@/features/credits/model/use-credits";
import {
  fetchCreditLots,
  fetchCreditTransactions,
  type CreditLotHistoryItem,
  type CreditTransactionHistoryItem,
  type HistoryPage,
} from "@/features/credits/model/history-api";
import { useAuth } from "@/shared/lib/use-auth";

type PageState<T> =
  | { status: "loading"; items: T[]; cursor: null; hasMore: false }
  | { status: "ready"; items: T[]; cursor: string | null; hasMore: boolean }
  | { status: "loading-more"; items: T[]; cursor: string; hasMore: true }
  | { status: "error"; items: T[]; cursor: string | null; hasMore: boolean };

function initialState<T>(): PageState<T> {
  return { status: "loading", items: [], cursor: null, hasMore: false };
}

function readyState<T>(page: HistoryPage<T>, previous: T[] = []): PageState<T> {
  return {
    status: "ready",
    items: [...previous, ...page.items],
    cursor: page.next_cursor,
    hasMore: page.has_more,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function transactionLabel(item: CreditTransactionHistoryItem) {
  if (item.transaction_type === "CHARGE") return "이용권 구매";
  if (item.transaction_type === "DEDUCT") return "GIF 합성 사용";
  return "합성 실패 이용권 복구";
}

function PurchaseCard({ item }: { item: CreditLotHistoryItem }) {
  const canceled = item.payment_status === "CANCELED";
  const usageRatio = item.granted_uses === 0
    ? 0
    : Math.round((item.remaining_uses / item.granted_uses) * 100);
  return (
    <article className="rounded-2xl border border-white/10 bg-[#141416] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-white">GIF 합성 {item.granted_uses}회 이용권</p>
          <p className="mt-1 text-xs text-white/35">{formatDate(item.approved_at ?? item.created_at)} 결제</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.expired ? "bg-white/10 text-white/45" : "bg-purple-500/15 text-purple-200"}`}>
          {item.expired ? "기간 만료" : `${item.remaining_uses}회 남음`}
        </span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-purple-500" style={{ width: `${usageRatio}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-white/50">사용 가능 {item.remaining_uses} / {item.granted_uses}회</span>
        <span className={item.expired ? "text-white/35" : "text-white/50"}>{formatDate(item.expires_at)}까지</span>
      </div>
      <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-4">
        <div>
          <p className="text-base font-bold text-white">{formatPrice(item.payment_amount, item.currency)}</p>
          <p className="mt-1 max-w-48 truncate text-[11px] text-white/25">주문 {item.order_id}</p>
        </div>
        <span className={`text-xs font-semibold ${canceled ? "text-red-300" : "text-emerald-300"}`}>
          {canceled ? "결제 취소" : "결제 완료"}
        </span>
      </div>
    </article>
  );
}

function TransactionRow({ item }: { item: CreditTransactionHistoryItem }) {
  const positive = item.signed_amount > 0;
  return (
    <li className="flex items-center gap-3 border-b border-white/[0.07] py-4 last:border-0">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${positive ? "bg-emerald-500/10 text-emerald-300" : "bg-white/[0.06] text-white/60"}`}>
        {positive ? "+" : "−"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/85">{transactionLabel(item)}</p>
        <p className="mt-1 text-xs text-white/35">
          {formatDateTime(item.created_at)}
          {item.reason ? ` · ${item.reason}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-bold tabular-nums ${positive ? "text-emerald-300" : "text-white"}`}>
          {positive ? "+" : "−"}{item.uses}회
        </p>
        {item.balance_after_uses !== null && (
          <p className="mt-1 text-xs tabular-nums text-white/35">잔여 {item.balance_after_uses}회</p>
        )}
      </div>
    </li>
  );
}

export function CreditHistoryPage() {
  const { authFetch } = useAuth();
  const [balance, setBalance] = useState<PassBalance | null>(null);
  const [lots, setLots] = useState<PageState<CreditLotHistoryItem>>(initialState);
  const [transactions, setTransactions] = useState<PageState<CreditTransactionHistoryItem>>(initialState);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        const nextBalance = await fetchCreditBalance(authFetch);
        if (!active) return;
        setBalance(nextBalance);
        const lotPage = await fetchCreditLots(authFetch);
        if (!active) return;
        setLots(readyState(lotPage));
        const transactionPage = await fetchCreditTransactions(authFetch);
        if (!active) return;
        setTransactions(readyState(transactionPage));
      } catch {
        if (!active) return;
        setLots({ status: "error", items: [], cursor: null, hasMore: false });
        setTransactions({ status: "error", items: [], cursor: null, hasMore: false });
      }
    }
    void loadHistory();
    return () => { active = false; };
  }, [authFetch]);

  async function loadMoreLots() {
    if (
      (lots.status !== "ready" && lots.status !== "error")
      || !lots.hasMore
      || !lots.cursor
    ) return;
    const previous = lots.items;
    const cursor = lots.cursor;
    setLots({ status: "loading-more", items: previous, cursor, hasMore: true });
    try {
      setLots(readyState(await fetchCreditLots(authFetch, cursor), previous));
    } catch {
      setLots({ status: "error", items: previous, cursor, hasMore: true });
    }
  }

  async function loadMoreTransactions() {
    if (
      (transactions.status !== "ready" && transactions.status !== "error")
      || !transactions.hasMore
      || !transactions.cursor
    ) return;
    const previous = transactions.items;
    const cursor = transactions.cursor;
    setTransactions({ status: "loading-more", items: previous, cursor, hasMore: true });
    try {
      setTransactions(readyState(await fetchCreditTransactions(authFetch, cursor), previous));
    } catch {
      setTransactions({ status: "error", items: previous, cursor, hasMore: true });
    }
  }

  const loading = lots.status === "loading" || transactions.status === "loading";
  const initialError = lots.status === "error" && lots.items.length === 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <section className="rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-500/15 to-transparent p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-300">available passes</p>
        <div className="mt-3 flex items-end gap-2">
          <strong className="text-4xl font-black tabular-nums text-white">
            {balance ? balance.remainingUses.toLocaleString() : "—"}
          </strong>
          <span className="pb-1 text-sm font-semibold text-white/50">회 남음</span>
        </div>
        {balance?.nearestExpiresAt && (
          <p className="mt-3 text-xs text-white/40">가장 가까운 만료일 {formatDate(balance.nearestExpiresAt)}</p>
        )}
      </section>

      {loading && <p className="py-20 text-center text-sm text-white/40">내역을 불러오는 중입니다.</p>}
      {initialError && <p className="py-20 text-center text-sm text-red-300/70">내역을 불러오지 못했습니다. 새로고침해 주세요.</p>}

      {!loading && !initialError && (
        <>
          <section className="mt-10">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white">결제 내역</h2>
              <p className="mt-1 text-sm text-white/40">구매별 잔여 횟수와 만료일을 확인할 수 있습니다.</p>
            </div>
            {lots.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-white/35">아직 결제한 이용권이 없습니다.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {lots.items.map((item) => <PurchaseCard key={item.lot_id} item={item} />)}
              </div>
            )}
            {lots.hasMore && (
              <button onClick={loadMoreLots} disabled={lots.status === "loading-more"} className="mt-4 w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/60 transition-colors hover:bg-white/5 disabled:opacity-40">
                {lots.status === "loading-more"
                  ? "불러오는 중"
                  : lots.status === "error" ? "다시 시도" : "결제 내역 더 보기"}
              </button>
            )}
          </section>

          <section className="mt-12">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white">이용권 변동 내역</h2>
              <p className="mt-1 text-sm text-white/40">구매, 합성 사용과 복구 기록입니다.</p>
            </div>
            {transactions.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-white/35">아직 이용권 변동 내역이 없습니다.</div>
            ) : (
              <ul className="rounded-2xl border border-white/10 bg-[#141416] px-5">
                {transactions.items.map((item) => <TransactionRow key={item.transaction_id} item={item} />)}
              </ul>
            )}
            {transactions.hasMore && (
              <button onClick={loadMoreTransactions} disabled={transactions.status === "loading-more"} className="mt-4 w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/60 transition-colors hover:bg-white/5 disabled:opacity-40">
                {transactions.status === "loading-more"
                  ? "불러오는 중"
                  : transactions.status === "error" ? "다시 시도" : "변동 내역 더 보기"}
              </button>
            )}
          </section>
        </>
      )}
    </main>
  );
}
