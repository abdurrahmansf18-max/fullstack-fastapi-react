import { useState } from "react";
export default function CreateH2Form({
  onCreate,
}: {
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onCreate(title.trim());
        setTitle("");
      }}
      className="mt-6 p-4 rounded-xl bg-gradient-to-br from-gray-50/80 to-gray-100/80 dark:from-gray-800/50 dark:to-gray-900/50 border border-dashed border-gray-300/60 dark:border-gray-700/60 backdrop-blur-sm"
    >
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Yeni Alt Başlık Adı"
          className="w-full rounded-xl border border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
        <button className="w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.01] text-sm">
          + Alt Başlık Ekle
        </button>
      </div>
    </form>
  );
}
