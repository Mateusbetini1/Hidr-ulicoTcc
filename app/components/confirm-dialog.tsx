'use client';

import { ReactNode, useEffect, useRef } from 'react';

/**
 * Modal de confirmação no padrão visual do sistema (substitui window.confirm).
 * Usa <dialog> nativo: o foco fica preso no modal, Esc fecha e o fundo é bloqueado.
 * Enquanto `busy`, não fecha (evita cancelar no meio de uma operação em andamento).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel,
  busyLabel = 'Aguarde…',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  busy = false,
  error = '',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  details?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="wg-dialog confirm-dialog"
      aria-labelledby="confirm-title"
      aria-describedby={description ? 'confirm-description' : undefined}
      onCancel={(event) => {
        // Esc: usa o mesmo caminho do botão Cancelar.
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(event) => {
        // Clique no fundo escurecido (o alvo é o próprio <dialog>) fecha o modal.
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div className="confirm-body">
        <div className="confirm-heading">
          <span className={`confirm-icon confirm-${tone}`} aria-hidden="true">
            {tone === 'danger' ? '!' : '?'}
          </span>
          <div>
            <h2 id="confirm-title">{title}</h2>
            {description && <p id="confirm-description">{description}</p>}
          </div>
        </div>

        {details && <div className="confirm-details">{details}</div>}

        {error && (
          <p className="quote-message error" role="alert">{error}</p>
        )}

        <div className="wg-dialog-actions">
          {/* autoFocus no Cancelar: em ações destrutivas, Enter não confirma por engano. */}
          <button className="secondary-button" type="button" onClick={onCancel} disabled={busy} autoFocus>
            {cancelLabel}
          </button>
          <button
            className={tone === 'danger' ? 'danger-button' : 'primary-button'}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
