"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ENTRY_PASSWORD = "BPDESKTEAM202605";

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
    <main className="min-h-screen flex items-center justify-center px-4 bg-cream">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-brand-100 p-10">
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Image
              src="/logo/wordmark-light.png"
              alt="Beauty Park 뷰티파크의원 범어점"
              width={220}
              height={220}
              priority
              className="mx-auto"
            />
          </div>
          <p className="text-sm tracking-widest text-brand-500 uppercase">일일 매출 보고 시스템</p>
        </div>

        <form onSubmit={handleEnter} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-700 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="비밀번호를 입력하세요"
              className="w-full px-4 py-3 border border-brand-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-cream/30"
              autoFocus
              required
            />
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!password}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-200 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors tracking-wide"
          >
            입장하기
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-brand-100 text-center">
          <a href="/admin" className="text-sm text-brand-500 hover:text-brand-700">
            관리자 페이지 →
          </a>
        </div>
      </div>
    </main>
  );
}
