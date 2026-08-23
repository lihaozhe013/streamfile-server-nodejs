import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
}

export default function Toast({
  message,
  tone = 'info',
  onDismiss,
}: ToastProps) {
  const Icon =
    tone === 'success' ? CheckCircle2 : tone === 'error' ? XCircle : Info;

  return (
    <div className={`toast toast-${tone}`} role="status">
      <Icon aria-hidden="true" size={18} />
      <span>{message}</span>
      <button
        className="icon-button toast-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
