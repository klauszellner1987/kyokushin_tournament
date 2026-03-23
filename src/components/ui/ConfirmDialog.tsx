import { AlertTriangle } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Löschen',
  cancelLabel = 'Abbrechen',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-kyokushin-red/15 rounded-lg">
            <AlertTriangle size={24} className="text-kyokushin-red" />
          </div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <p className="text-sm text-kyokushin-text mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-kyokushin-border hover:bg-kyokushin-card-hover text-white py-3 rounded-lg font-medium transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-3 rounded-lg font-bold transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
