import React, { useEffect, useState } from 'react';

/**
 * ConfirmModal - A premium, theme-consistent confirmation dialog.
 * 
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {Function} onClose - Called when the user cancels or clicks backdrop.
 * @param {Function} onConfirm - Called when the user confirms.
 * @param {string} title - The main question or title.
 * @param {string} message - Secondary descriptive text.
 * @param {string} confirmText - Label for the confirm button.
 * @param {string} cancelText - Label for the cancel button.
 * @param {boolean} isDanger - Whether the confirm action is destructive (red).
 */
export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "확인하시겠어요?", 
  message = "", 
  confirmText = "확인", 
  cancelText = "취소",
  isDanger = false 
}) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    }
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setShouldRender(false);
  };

  if (!shouldRender) return null;

  return (
    <div 
      className={`modal-overlay ${isOpen ? 'open' : 'closing'}`}
      onAnimationEnd={handleAnimationEnd}
      onClick={onClose}
    >
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-body">
          <h3 className="modal-title">{title}</h3>
          {message && <p className="modal-message">{message}</p>}
        </div>
        
        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button 
            className={`modal-btn confirm ${isDanger ? 'danger' : 'primary'}`} 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 10000;
          animation: fadeIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        .modal-overlay.closing {
          animation: fadeOut 0.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .modal-content {
          background: #161616;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 28px;
          width: 100%;
          max-width: 320px;
          overflow: hidden;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
          transform: scale(0.9) translateY(10px);
          animation: scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        .modal-overlay.closing .modal-content {
          animation: scaleDown 0.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .modal-body {
          padding: 40px 24px 32px;
          text-align: center;
        }

        .modal-title {
          color: white;
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          line-height: 1.4;
          white-space: pre-line;
          letter-spacing: -0.02em;
        }

        .modal-message {
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
          font-weight: 400;
          margin: 14px 0 0;
          line-height: 1.6;
          white-space: pre-line;
        }

        .modal-footer {
          display: flex;
          padding: 0 20px 24px;
          gap: 12px;
        }

        .modal-btn {
          flex: 1;
          height: 52px;
          border: none;
          border-radius: 14px;
          font-family: inherit;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .modal-btn.cancel {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.5);
        }

        .modal-btn.cancel:active {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(0.98);
        }

        .modal-btn.primary {
          background: #4adf84;
          color: #0e0e0e;
        }

        .modal-btn.primary:active {
          background: #3bc974;
          transform: scale(0.98);
          box-shadow: 0 0 20px rgba(74, 223, 132, 0.2);
        }

        .modal-btn.danger {
          background: rgba(255, 82, 82, 0.1);
          color: #ff5252;
          border: 1px solid rgba(255, 82, 82, 0.2);
        }

        .modal-btn.danger:active {
          background: rgba(255, 82, 82, 0.2);
          transform: scale(0.98);
        }


        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes scaleUp {
          to { transform: scale(1) translateY(0); }
        }

        @keyframes scaleDown {
          from { transform: scale(1) translateY(0); }
          to { transform: scale(0.95) translateY(5px); }
        }
      `}</style>
    </div>
  );
}
