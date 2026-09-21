"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/shared/lib/api-base";

type Overview = {
  today_compositions: number;
  today_failed_compositions: number;
  today_payment_amount: number;
  today_ready_payments: number;
  today_ready_payment_amount: number;
  today_credit_grants: number;
  missing_credit_candidates: number;
};

type Payment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  credit_amount: number;
  provider_payment_id: string | null;
  provider_transaction_id: string | null;
  status: string;
  failed_reason: string | null;
  created_at: string | null;
  approved_at: string | null;
  credit_granted_at: string | null;
  credit_transaction_exists: boolean;
  needs_credit_grant: boolean;
};

type CreditTransaction = {
  id: string;
  amount: number;
  signed_amount: number;
  uses: number;
  transaction_type: string;
  source_type: string | null;
  source_id: string | null;
  reason: string | null;
  created_at: string | null;
};

type CreditLot = {
  id: string;
  source_type: string | null;
  source_id: string | null;
  granted_amount: number;
  granted_uses: number;
  remaining_amount: number;
  remaining_uses: number;
  expires_at: string;
  expired: boolean;
  created_at: string;
};

type CreditCase = {
  user: {
    id: string;
    email: string | null;
    provider: string;
    role: string;
    status: string;
    created_at: string | null;
    credit_balance: number;
    credit_remaining_uses: number;
  };
  payments: Payment[];
  credit_transactions: CreditTransaction[];
  credit_lots: CreditLot[];
};

type CreditCaseResponse = Omit<CreditCase, "user" | "credit_transactions" | "credit_lots"> & {
  user: Omit<CreditCase["user"], "credit_remaining_uses"> & {
    credit_remaining_uses?: number;
  };
  credit_transactions: Array<Omit<CreditTransaction, "signed_amount" | "uses"> & {
    signed_amount?: number;
    uses?: number;
  }>;
  credit_lots?: CreditLot[];
};

type GrantForm = {
  amount: string;
  reason: string;
  paymentId: string;
  idempotencyKey: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatWon(amount: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function readError(res: Response) {
  try {
    const data = await res.json();
    if (typeof data.message === "string") return data.message;
    if (typeof data.detail === "string") return data.detail;
  } catch {
    return "요청을 처리하지 못했습니다";
  }
  return "요청을 처리하지 못했습니다";
}

function statusBadgeClass(status: string) {
  if (status === "APPROVED") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (status === "FAILED" || status === "CANCELED") return "border-red-400/30 bg-red-500/10 text-red-200";
  return "border-yellow-400/30 bg-yellow-500/10 text-yellow-200";
}

function makeIdempotencyKey() {
  return crypto.randomUUID();
}

function normalizeCreditCase(data: CreditCaseResponse): CreditCase {
  return {
    ...data,
    user: {
      ...data.user,
      credit_remaining_uses: data.user.credit_remaining_uses
        ?? Math.floor(data.user.credit_balance / 10),
    },
    credit_transactions: data.credit_transactions.map((transaction) => {
      const positive = transaction.transaction_type === "CHARGE"
        || transaction.transaction_type === "REFUND";
      return {
        ...transaction,
        signed_amount: transaction.signed_amount
          ?? (positive ? transaction.amount : -transaction.amount),
        uses: transaction.uses ?? Math.floor(transaction.amount / 10),
      };
    }),
    credit_lots: data.credit_lots ?? [],
  };
}

export function AdminDashboardClient({ adminPath }: { adminPath: string }) {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [creditCase, setCreditCase] = useState<CreditCase | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [grantForm, setGrantForm] = useState<GrantForm>({
    amount: "",
    reason: "",
    paymentId: "",
    idempotencyKey: makeIdempotencyKey(),
  });
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);

  const endpoint = useMemo(() => `${API_BASE}${adminPath}`, [adminPath]);

  useEffect(() => {
    fetch(`${endpoint}/me`, { credentials: "include" })
      .then((res) => setAccess(res.ok ? "allowed" : "denied"))
      .catch(() => setAccess("denied"));
  }, [endpoint]);

  const loadOverview = useCallback(async () => {
    setOverviewError(null);
    try {
      const res = await fetch(`${endpoint}/overview`, { credentials: "include" });
      if (!res.ok) {
        setOverviewError(await readError(res));
        return;
      }
      setOverview(await res.json());
    } catch {
      setOverviewError("요청을 처리하지 못했습니다");
    }
  }, [endpoint]);

  async function searchCreditCase(nextQuery = query) {
    const trimmed = nextQuery.trim();
    if (!trimmed) {
      setMessage("이메일, user_id, order_id, Toss id 중 하나를 입력하세요.");
      return;
    }
    setSearching(true);
    setMessage(null);
    try {
      const res = await fetch(`${endpoint}/support/credit-case?query=${encodeURIComponent(trimmed)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setCreditCase(null);
        setMessage(await readError(res));
        return;
      }
      const data = await res.json() as CreditCaseResponse;
      setCreditCase(normalizeCreditCase(data));
    } catch {
      setCreditCase(null);
      setMessage("요청을 처리하지 못했습니다");
    } finally {
      setSearching(false);
    }
  }

  async function recheckPayment(paymentId: string) {
    setBusyPaymentId(paymentId);
    setMessage(null);
    try {
      const res = await fetch(`${endpoint}/payments/${paymentId}/recheck`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setMessage(await readError(res));
        return;
      }
      const data = await res.json();
      setMessage(`토스 재조회 완료: ${data.toss.pay_status}`);
      await searchCreditCase();
      await loadOverview();
    } catch {
      setMessage("요청을 처리하지 못했습니다");
    } finally {
      setBusyPaymentId(null);
    }
  }

  function preparePaymentGrant(payment: Payment) {
    setGrantForm({
      amount: String(payment.credit_amount),
      reason: "토스 결제 완료 확인, 자동 크레딧 지급 누락 보정",
      paymentId: payment.id,
      idempotencyKey: makeIdempotencyKey(),
    });
  }

  async function grantCredit() {
    if (!creditCase) return;
    const amount = Number(grantForm.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage("지급 크레딧은 1 이상의 정수여야 합니다.");
      return;
    }
    if (grantForm.reason.trim().length < 3) {
      setMessage("지급 사유를 입력하세요.");
      return;
    }

    setGranting(true);
    setMessage(null);
    try {
      const res = await fetch(`${endpoint}/credits/grant`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: creditCase.user.id,
          amount,
          reason: grantForm.reason.trim(),
          idempotency_key: grantForm.idempotencyKey,
          payment_id: grantForm.paymentId.trim() || null,
        }),
      });
      if (!res.ok) {
        setMessage(await readError(res));
        return;
      }
      const data = await res.json();
      setMessage(`크레딧 지급 완료. 현재 잔액: ${data.balance.toLocaleString()}`);
      setGrantForm({
        amount: "",
        reason: "",
        paymentId: "",
        idempotencyKey: makeIdempotencyKey(),
      });
      await searchCreditCase();
      await loadOverview();
    } catch {
      setMessage("요청을 처리하지 못했습니다");
    } finally {
      setGranting(false);
    }
  }

  useEffect(() => {
    if (access !== "allowed") return;
    loadOverview();
  }, [access, loadOverview]);

  if (access === "checking") {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-screen-xl items-center justify-center px-4 py-8">
        <p className="text-sm text-white/50">권한을 확인하고 있습니다...</p>
      </main>
    );
  }

  if (access === "denied") {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-screen-xl flex-col items-center justify-center px-4 py-8 text-center">
        <h1 className="text-5xl font-black">404</h1>
        <p className="mt-4 text-white/50">This page could not be found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm font-semibold text-purple-300">ops dashboard</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">운영 대시보드</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
          결제/크레딧 CS 처리를 위한 관리자 화면입니다. 결제 재조회와 크레딧 수동 지급은 audit log에 기록됩니다.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["오늘 성공 합성", overview?.today_compositions.toLocaleString() ?? "-"],
          ["오늘 실패 작업", overview?.today_failed_compositions.toLocaleString() ?? "-"],
          ["오늘 결제 금액", overview ? formatWon(overview.today_payment_amount) : "-"],
          [
            "결제 확인 대기",
            overview
              ? `${overview.today_ready_payments.toLocaleString()}건 / ${formatWon(overview.today_ready_payment_amount)}`
              : "-",
          ],
          ["오늘 지급 크레딧", overview?.today_credit_grants.toLocaleString() ?? "-"],
          ["지급 누락 의심", overview?.missing_credit_candidates.toLocaleString() ?? "-"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#111113] p-5">
            <p className="text-xs font-semibold text-white/40">{label}</p>
            <p className="mt-3 text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </section>

      {overviewError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {overviewError}
        </div>
      )}

      <section className="rounded-3xl border border-white/10 bg-[#111113] p-5">
        <h2 className="text-lg font-bold">크레딧 CS 검색</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") searchCreditCase();
            }}
            placeholder="이메일 / user_id / order_id / Toss payToken / transactionId"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-purple-400/60"
          />
          <button
            onClick={() => searchCreditCase()}
            disabled={searching}
            className="rounded-2xl bg-purple-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-500 disabled:cursor-wait disabled:opacity-50"
          >
            {searching ? "검색 중" : "검색"}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-purple-200">{message}</p>}
      </section>

      {creditCase && (
        <>
          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-white/10 bg-[#111113] p-5">
              <h2 className="text-lg font-bold">사용자 정보</h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-white/35">email</dt>
                  <dd className="mt-1 font-semibold">{creditCase.user.email ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-white/35">user_id</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-white/70">{creditCase.user.id}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-white/35">사용 가능 크레딧</dt>
                    <dd className="mt-1 text-2xl font-black">{creditCase.user.credit_balance.toLocaleString()}</dd>
                    <dd className="mt-1 text-xs text-white/45">
                      합성 {creditCase.user.credit_remaining_uses.toLocaleString()}회
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/35">상태</dt>
                    <dd className="mt-1 font-semibold">{creditCase.user.status}</dd>
                  </div>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#111113] p-5">
              <h2 className="text-lg font-bold">크레딧 지급</h2>
              <div className="mt-4 grid gap-3">
                <input
                  value={grantForm.amount}
                  onChange={(e) => setGrantForm((current) => ({ ...current, amount: e.target.value }))}
                  placeholder="지급 크레딧"
                  inputMode="numeric"
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-purple-400/60"
                />
                <input
                  value={grantForm.paymentId}
                  onChange={(e) => setGrantForm((current) => ({ ...current, paymentId: e.target.value }))}
                  placeholder="관련 payment_id (선택)"
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-purple-400/60"
                />
                <textarea
                  value={grantForm.reason}
                  onChange={(e) => setGrantForm((current) => ({ ...current, reason: e.target.value }))}
                  placeholder="지급 사유 필수"
                  rows={3}
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-purple-400/60"
                />
                <button
                  onClick={grantCredit}
                  disabled={granting}
                  className="rounded-2xl bg-purple-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-500 disabled:cursor-wait disabled:opacity-50"
                >
                  {granting ? "지급 중" : "크레딧 지급"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#111113] p-5">
            <h2 className="text-lg font-bold">크레딧 지급분</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs text-white/35">
                  <tr>
                    <th className="py-2 pr-3">지급일</th>
                    <th className="py-2 pr-3">source</th>
                    <th className="py-2 pr-3">지급</th>
                    <th className="py-2 pr-3">사용 가능</th>
                    <th className="py-2 pr-3">만료일</th>
                    <th className="py-2 pr-3">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {creditCase.credit_lots.map((lot) => (
                    <tr key={lot.id} className="border-t border-white/10">
                      <td className="py-3 pr-3">{formatDate(lot.created_at)}</td>
                      <td className="py-3 pr-3 font-mono text-xs text-white/60">
                        {lot.source_type ?? "-"} {lot.source_id ? `/${lot.source_id}` : ""}
                      </td>
                      <td className="py-3 pr-3">
                        {lot.granted_amount.toLocaleString()} ({lot.granted_uses.toLocaleString()}회)
                      </td>
                      <td className="py-3 pr-3 font-bold">
                        {lot.remaining_amount.toLocaleString()} ({lot.remaining_uses.toLocaleString()}회)
                      </td>
                      <td className="py-3 pr-3">{formatDate(lot.expires_at)}</td>
                      <td className="py-3 pr-3">
                        <span className={lot.expired ? "text-white/35" : "text-emerald-200"}>
                          {lot.expired ? "만료" : "사용 가능"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {creditCase.credit_lots.length === 0 && (
                <p className="py-8 text-center text-sm text-white/40">크레딧 지급분이 없습니다.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#111113] p-5">
            <h2 className="text-lg font-bold">결제 내역</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="text-xs text-white/35">
                  <tr>
                    <th className="py-2 pr-3">상태</th>
                    <th className="py-2 pr-3">order_id</th>
                    <th className="py-2 pr-3">금액</th>
                    <th className="py-2 pr-3">크레딧</th>
                    <th className="py-2 pr-3">지급</th>
                    <th className="py-2 pr-3">승인일</th>
                    <th className="py-2 pr-3">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {creditCase.payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-white/10">
                      <td className="py-3 pr-3">
                        <span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusBadgeClass(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-white/70">{payment.order_id}</td>
                      <td className="py-3 pr-3">{formatWon(payment.amount)}</td>
                      <td className="py-3 pr-3">{payment.credit_amount.toLocaleString()}</td>
                      <td className="py-3 pr-3">
                        {payment.needs_credit_grant ? (
                          <span className="text-yellow-200">지급 필요 가능성</span>
                        ) : payment.credit_granted_at || payment.credit_transaction_exists ? (
                          <span className="text-emerald-200">지급 확인</span>
                        ) : (
                          <span className="text-white/35">-</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">{formatDate(payment.approved_at)}</td>
                      <td className="py-3 pr-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => recheckPayment(payment.id)}
                            disabled={busyPaymentId === payment.id}
                            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 hover:border-white/35 hover:text-white disabled:cursor-wait disabled:opacity-50"
                          >
                            {busyPaymentId === payment.id ? "조회 중" : "토스 재조회"}
                          </button>
                          {payment.needs_credit_grant && (
                            <button
                              onClick={() => preparePaymentGrant(payment)}
                              className="rounded-full bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-500"
                            >
                              지급 폼 채우기
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {creditCase.payments.length === 0 && (
                <p className="py-8 text-center text-sm text-white/40">결제 내역이 없습니다.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#111113] p-5">
            <h2 className="text-lg font-bold">크레딧 거래 내역</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs text-white/35">
                  <tr>
                    <th className="py-2 pr-3">일시</th>
                    <th className="py-2 pr-3">타입</th>
                    <th className="py-2 pr-3">수량</th>
                    <th className="py-2 pr-3">source</th>
                    <th className="py-2 pr-3">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {creditCase.credit_transactions.map((tx) => (
                    <tr key={tx.id} className="border-t border-white/10">
                      <td className="py-3 pr-3">{formatDate(tx.created_at)}</td>
                      <td className="py-3 pr-3">{tx.transaction_type}</td>
                      <td className={`py-3 pr-3 font-bold ${tx.signed_amount > 0 ? "text-emerald-200" : "text-white"}`}>
                        {tx.signed_amount > 0 ? "+" : "−"}
                        {Math.abs(tx.signed_amount).toLocaleString()} ({tx.uses.toLocaleString()}회)
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-white/60">
                        {tx.source_type ?? "-"} {tx.source_id ? `/${tx.source_id}` : ""}
                      </td>
                      <td className="py-3 pr-3 text-white/70">{tx.reason ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {creditCase.credit_transactions.length === 0 && (
                <p className="py-8 text-center text-sm text-white/40">크레딧 거래 내역이 없습니다.</p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
