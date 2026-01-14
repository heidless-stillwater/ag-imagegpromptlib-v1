'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Attachment, MediaImage, PromptSet, PromptVersion } from '@/types';
import { getMediaImages } from '@/services/media';
import { getPromptSets } from '@/services/promptSets';
import {
    uploadAttachment,
    attachFromMedia,
    attachFromVersion,
    sanitizeAttachmentName,
    generateUniqueName,
} from '@/services/attachments';
import styles from './AttachmentPicker.module.css';

interface AttachmentPickerProps {
    existingAttachments: Attachment[];
    onAdd: (attachment: Attachment) => void;
    onClose: () => void;
}

type Tab = 'upload' | 'media' | 'promptsets';

export default function AttachmentPicker({
    existingAttachments,
    onAdd,
    onClose,
}: AttachmentPickerProps) {
    const [activeTab, setActiveTab] = useState<Tab>('upload');
    const [mediaImages, setMediaImages] = useState<MediaImage[]>([]);
    const [promptSets, setPromptSets] = useState<PromptSet[]>([]);
    const [selectedPromptSet, setSelectedPromptSet] = useState<PromptSet | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const existingNames = existingAttachments.map(a => a.name);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [media, sets] = await Promise.all([
                getMediaImages(),
                getPromptSets()
            ]);
            setMediaImages(media);
            setPromptSets(sets);
        } catch (err) {
            console.error('Failed to load data:', err);
            setError('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setIsLoading(true);
        setError('');

        try {
            for (const file of Array.from(files)) {
                const baseName = sanitizeAttachmentName(file.name.replace(/\.[^/.]+$/, ''));
                const uniqueName = generateUniqueName(baseName, existingNames);
                const attachment = await uploadAttachment(file, uniqueName);
                if (attachment) {
                    existingNames.push(attachment.name);
                    onAdd(attachment);
                }
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleFileUpload(e.dataTransfer.files);
    }, [existingNames]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleMediaSelect = async (media: MediaImage) => {
        setIsLoading(true);
        setError('');

        try {
            const baseName = sanitizeAttachmentName(`media_${media.id.substring(0, 8)}`);
            const uniqueName = generateUniqueName(baseName, existingNames);
            const attachment = await attachFromMedia(media, uniqueName);
            onAdd(attachment);
            onClose();
        } catch (err) {
            setError('Failed to attach from media');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVersionSelect = async (version: PromptVersion, promptSet: PromptSet) => {
        if (!version.imageUrl) {
            setError('This version has no image to attach');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const baseName = sanitizeAttachmentName(`${promptSet.title}_v${version.versionNumber}`);
            const uniqueName = generateUniqueName(baseName, existingNames);
            const attachment = await attachFromVersion(version, promptSet, uniqueName);
            if (attachment) {
                onAdd(attachment);
                onClose();
            }
        } catch (err) {
            setError('Failed to attach from version');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredMedia = mediaImages.filter(m =>
        !searchQuery || m.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredPromptSets = promptSets.filter(ps =>
        !searchQuery || ps.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.picker} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3>Attach File</h3>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'upload' ? styles.active : ''}`}
                        onClick={() => setActiveTab('upload')}
                    >
                        📤 Upload
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'media' ? styles.active : ''}`}
                        onClick={() => setActiveTab('media')}
                    >
                        🖼️ Media Library
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'promptsets' ? styles.active : ''}`}
                        onClick={() => setActiveTab('promptsets')}
                    >
                        📋 PromptSets
                    </button>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.content}>
                    {activeTab === 'upload' && (
                        <div
                            className={`${styles.dropZone} ${dragOver ? styles.dragOver : ''}`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={e => handleFileUpload(e.target.files)}
                                className={styles.fileInput}
                            />
                            <span className={styles.uploadIcon}>📁</span>
                            <p className={styles.uploadText}>
                                {isLoading ? 'Uploading...' : 'Drop files here or click to browse'}
                            </p>
                            <p className={styles.uploadHint}>Max 10MB per file</p>
                        </div>
                    )}

                    {activeTab === 'media' && (
                        <div className={styles.mediaTab}>
                            <input
                                type="text"
                                placeholder="Search media..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className={styles.searchInput}
                            />
                            {isLoading ? (
                                <div className={styles.loading}>Loading...</div>
                            ) : filteredMedia.length === 0 ? (
                                <div className={styles.empty}>No media found</div>
                            ) : (
                                <div className={styles.mediaGrid}>
                                    {filteredMedia.map(media => (
                                        <button
                                            key={media.id}
                                            className={styles.mediaItem}
                                            onClick={() => handleMediaSelect(media)}
                                            disabled={isLoading}
                                        >
                                            <img src={media.url} alt="" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'promptsets' && (
                        <div className={styles.promptSetsTab}>
                            <input
                                type="text"
                                placeholder="Search prompt sets..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className={styles.searchInput}
                            />
                            {isLoading ? (
                                <div className={styles.loading}>Loading...</div>
                            ) : selectedPromptSet ? (
                                <div className={styles.versionsList}>
                                    <button
                                        className={styles.backBtn}
                                        onClick={() => setSelectedPromptSet(null)}
                                    >
                                        ← Back to PromptSets
                                    </button>
                                    <h4>{selectedPromptSet.title}</h4>
                                    {selectedPromptSet.versions.filter(v => v.imageUrl).length === 0 ? (
                                        <div className={styles.empty}>No versions with images</div>
                                    ) : (
                                        <div className={styles.versionsGrid}>
                                            {selectedPromptSet.versions
                                                .filter(v => v.imageUrl)
                                                .map(version => (
                                                    <button
                                                        key={version.id}
                                                        className={styles.versionItem}
                                                        onClick={() => handleVersionSelect(version, selectedPromptSet)}
                                                        disabled={isLoading}
                                                    >
                                                        <img src={version.imageUrl} alt="" />
                                                        <span>v{version.versionNumber}</span>
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            ) : filteredPromptSets.length === 0 ? (
                                <div className={styles.empty}>No prompt sets found</div>
                            ) : (
                                <div className={styles.promptSetsList}>
                                    {filteredPromptSets.map(ps => {
                                        const firstImageVersion = ps.versions.find(v => v.imageUrl);
                                        return (
                                            <button
                                                key={ps.id}
                                                className={styles.promptSetItem}
                                                onClick={() => setSelectedPromptSet(ps)}
                                            >
                                                {firstImageVersion?.imageUrl && (
                                                    <div className={styles.psThumbnail}>
                                                        <img src={firstImageVersion.imageUrl} alt="" />
                                                    </div>
                                                )}
                                                <div className={styles.psInfo}>
                                                    <span className={styles.psTitle}>{ps.title}</span>
                                                    <span className={styles.psVersions}>
                                                        {ps.versions.filter(v => v.imageUrl).length} versions with images
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
