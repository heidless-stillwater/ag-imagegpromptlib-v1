'use client';

import { ReactNode } from 'react';
import Modal from './Modal';
import Button from './Button';
import styles from './ConfirmationModal.module.css';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    variant?: 'danger' | 'info' | 'success';
    isLoading?: boolean;
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    variant = 'info',
    isLoading = false,
}: ConfirmationModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <div className={`${styles.content} ${styles[`variant_${variant}`]}`}>
                <div className={styles.messageContainer}>{message}</div>

                <div className={styles.actions}>
                    {cancelLabel && (
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelLabel}
                        </Button>
                    )}
                    {onConfirm && (
                        <Button
                            variant={variant === 'info' ? 'primary' : variant}
                            onClick={onConfirm}
                            isLoading={isLoading}
                        >
                            {confirmLabel}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
