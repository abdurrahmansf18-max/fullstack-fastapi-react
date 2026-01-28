import { useState } from "react";

export default function CreateCategoryForm({
  onCreate,
}: {
  onCreate: (name: string, description?: string) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate(name.trim(), desc.trim() || undefined);
        setName("");
        setDesc("");
      }}
      className="mt-8 p-5 rounded-xl bg-gradient-to-br from-gray-50/80 to-gray-100/80 dark:from-gray-800/50 dark:to-gray-900/50 border border-dashed border-gray-300/60 dark:border-gray-700/60 backdrop-blur-sm"
    >
      <div className="font-semibold mb-4 text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <span className="text-emerald-600 dark:text-emerald-400">+</span> Yeni
        Kategori Ekle
      </div>
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Kategori Adı"
          className="w-full rounded-xl border border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Açıklama (opsiyonel)"
          className="w-full rounded-xl border border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
        <button className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-2">
          <span>+</span> Kategori Ekle
        </button>
      </div>
    </form>
  );
}
