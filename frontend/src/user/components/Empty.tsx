// src/public/components/Empty.tsx
export default function Empty({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl mb-4 opacity-50">{icon}</div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 max-w-md">{subtitle}</p>
    </div>
  );
}
