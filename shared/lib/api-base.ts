if (!process.env.NEXT_PUBLIC_API_BASE) {
  throw new Error("NEXT_PUBLIC_API_BASE 환경변수가 설정되지 않았습니다");
}
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
