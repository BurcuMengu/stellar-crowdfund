import { useToast } from "../state/ToastContext";

const KIND_STYLES = {
  success: "bg-green-600",
  error: "bg-red-600",
  info: "bg-gray-800",
} as const;

export function ToastHost() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`w-full max-w-md rounded-lg px-4 py-3 text-left text-sm text-white shadow-lg ${KIND_STYLES[t.kind]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
