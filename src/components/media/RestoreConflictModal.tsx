'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import styles from './RestoreConflictModal.module.css';
import { Resolution } from '@/services/zip';

interface RestoreConflictModalProps {
    filename: string;
    previewUrl?: string;
    onResolve: (resolution: Resolution) => void;
}

export default function RestoreConflictModal({ filename, previewUrl, onResolve }: RestoreConflictModalProps) {
    const [applyToAll, setApplyToAll] = useState(false);

    const handleAction = (action: 'overwrite' | 'skip') => {
        if (applyToAll) {
            onResolve(action === 'overwrite' ? 'overwriteAll' : 'skipAll');
        } else {
            onResolve(action);
        }
    };

    return (
        <Modal isOpen={true} onClose={() => { }} title="File Already Exists" size="md">
            <div className={styles.container}>
                <div className={styles.icon}>⚠️</div>

                {previewUrl && (
                    <div className={styles.previewContainer}>
                        <img src={previewUrl} alt="Preview" className={styles.preview} />
                    </div>
                )}

                <p className={styles.message}>
                    The file <span className={styles.filenameTag}>{filename}</span> already exists in your Media Library.
                </p>
                <p className={styles.subtext}>
                    Would you like to overwrite it or skip this file?
                </p>

                <div className={styles.checkboxWrapper}>
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={applyToAll}
                            onChange={(e) => setApplyToAll(e.target.checked)}
                        />
                        Apply to all remaining conflicts
                    </label>
                </div>

                <div className={styles.actions}>
                    <Button variant="secondary" onClick={() => handleAction('skip')}>
                        Skip
                    </Button>
                    <Button variant="primary" onClick={() => handleAction('overwrite')}>
                        Overwrite
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
