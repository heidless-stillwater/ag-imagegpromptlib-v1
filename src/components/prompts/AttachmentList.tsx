'use client';

import { Attachment } from '@/types';
import styles from './AttachmentList.module.css';

interface AttachmentListProps {
    attachments: Attachment[];
    onRemove?: (id: string) => void;
    onCopyRef?: (name: string) => void;
    readonly?: boolean;
}

export default function AttachmentList({
    attachments,
    onRemove,
    onCopyRef,
    readonly = false,
}: AttachmentListProps) {
    if (attachments.length === 0) {
        return null;
    }

    const getSourceLabel = (attachment: Attachment): string => {
        switch (attachment.source) {
            case 'upload':
                return 'Uploaded';
            case 'media':
                return 'Media Library';
            case 'promptset_version':
                return attachment.sourcePromptSetTitle || 'PromptSet';
            default:
                return '';
        }
    };

    const handleCopyRef = async (name: string) => {
        const refText = `{{file:${name}}}`;
        try {
            await navigator.clipboard.writeText(refText);
            onCopyRef?.(name);
        } catch (err) {
            console.error('Failed to copy reference:', err);
        }
    };

    return (
        <div className={styles.container}>
            <label className={styles.label}>
                Attachments ({attachments.length})
            </label>
            <div className={styles.list}>
                {attachments.map((attachment) => (
                    <div key={attachment.id} className={styles.item}>
                        <div className={styles.preview}>
                            {attachment.type === 'image' ? (
                                <img
                                    src={attachment.url}
                                    alt={attachment.name}
                                    className={styles.thumbnail}
                                />
                            ) : (
                                <span className={styles.fileIcon}>📄</span>
                            )}
                        </div>
                        <div className={styles.info}>
                            <span className={styles.name}>{attachment.name}</span>
                            <span className={styles.source}>{getSourceLabel(attachment)}</span>
                        </div>
                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={styles.copyBtn}
                                onClick={() => handleCopyRef(attachment.name)}
                                title="Copy reference"
                            >
                                📋
                            </button>
                            {!readonly && onRemove && (
                                <button
                                    type="button"
                                    className={styles.removeBtn}
                                    onClick={() => onRemove(attachment.id)}
                                    title="Remove"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {!readonly && (
                <p className={styles.hint}>
                    Use <code>{`{{file:name}}`}</code> in your prompt to reference attachments
                </p>
            )}
        </div>
    );
}
