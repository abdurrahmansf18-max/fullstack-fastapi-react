// src/admin/components/CreateAdminForm.tsx
import { useState } from "react";

export default function CreateAdminForm({
  onCreate,
  showNotification,
}: {
  onCreate: (email: string, password: string) => void;
  showNotification: (m: string, t?: "error" | "success" | "warning") => void;
}) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const validate = (p: string) => {
    if (p.length < 8) return "Şifre en az 8 karakter olmalıdır";
    if (!/[a-z]/.test(p)) return "Şifre en az bir küçük harf içermelidir";
    if (!/[0-9]/.test(p)) return "Şifre en az bir rakam içermelidir";
    return "";
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = validate(pw);
        if (v) {
          showNotification(v, "error");
          return;
        }
        onCreate(email.trim(), pw);
        setEmail("");
        setPw("");
        setErr("");
      }}
      className="mt-8 p-5 rounded-xl bg-gradient-to-br from-gray-50/80 to-gray-100/80 dark:from-gray-800/50 dark:to-gray-900/50 border border-dashed border-gray-300/60 dark:border-gray-700/60 backdrop-blur-sm"
    >
      <div className="font-semibold mb-4 text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <span className="text-orange-600 dark:text-orange-400">+</span> Yeni
        Admin Ekle
      </div>
      <div className="space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-posta"
          className="w-full rounded-xl border border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200"
        />
        <input
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setErr(validate(e.target.value));
          }}
          placeholder="Şifre"
          className={`w-full rounded-xl border ${
            err
              ? "border-red-400 dark:border-red-500 focus:ring-red-500/20 focus:border-red-500"
              : "border-gray-300/60 dark:border-gray-700/60 focus:ring-emerald-500/20 focus:border-emerald-500"
          } bg-white/90 dark:bg-gray-800/80 px-4 py-3 text-sm`}
        />
        <button
          type="submit"
          disabled={!!err || !pw || !email}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          Admin Ekle
        </button>
      </div>
    </form>
  );
}
