import type { Trip } from '../types';

interface DeleteConfirmModalProps {
  trip: Trip;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  trip,
  deleting,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel}></div>

      <div className="relative bg-background-50 rounded-xl w-full max-w-sm p-6">
        <span className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <i className="ri-delete-bin-line text-2xl text-red-500"></i>
        </span>

        <h3 className="font-heading font-bold text-lg text-foreground-900 mb-2">
          Delete this trip?
        </h3>
        <p className="text-foreground-500 text-sm mb-6">
          &ldquo;{trip.title}&rdquo; will be permanently removed. This action cannot be undone.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 border border-background-300 text-foreground-700 font-semibold text-sm px-4 py-2.5 rounded-md hover:bg-background-100 transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm px-4 py-2.5 rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
