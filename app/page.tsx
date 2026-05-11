"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ENTRY_PASSWORD = "bpdeskteam";

export default function HomePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleEnter = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== ENTRY_PASSWORD) {
      setError("비밀번호가 올바르지 않습니다.");
      return;
    }
    setError(null);
    localStorage.setItem("bp_entered", "yes");
    localStorage.setItem("bp_entry_pw", password);
    router.push("/report");
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-100 text-brand-600 text-2xl font-bold mb-3">
            B
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">뷰티파크의원</h1>
          <p className="text-sm text-neutral-500 mt-1">일일 매출 보고 시스템</p>
        </div>

        <form onSubmit={handleEnter} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="비밀번호를 입력하세요"
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              autoFocus
              required
            />
          </div>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!password}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            입장하기
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-neutral-200 text-center">
          <a href="/admin" className="text-sm text-neutral-500 hover:text-brand-600">
            관리자 페이지 →
          </a>
        </div>
      </div>
    </main>
  );
}
