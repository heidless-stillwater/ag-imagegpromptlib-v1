'use client';

import { useState, useEffect } from 'react';
import { AspectRatio } from '@/types';
import {
    getAspectRatios,
    createAspectRatio,
    updateAspectRatio,
    deleteAspectRatio
} from '@/services/aspectRatios';
import { updateUserProfile } from '@/services/auth';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { useAuth } from '@/contexts/AuthContext';
import styles from './AspectRatioExplorer.module.css';

export default function AspectRatioExplorer() {
    const { user, isAdmin } = useAuth();
    const [ratios, setRatios] = useState<AspectRatio[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingRatio, setEditingRatio] = useState<AspectRatio | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string; name: string } | null>(null);

    // Form fields
    const [name, setName] = useState('');
    const [value, setValue] = useState('');
    const [primaryUseCase, setPrimaryUseCase] = useState('');
    const [visualFeel, setVisualFeel] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [imageDefaultAR, setImageDefaultAR] = useState(false);
    const [videoDefaultAR, setVideoDefaultAR] = useState(false);
    const [isSystem, setIsSystem] = useState(false);

    useEffect(() => {
        loadRatios();
    }, []);

    const loadRatios = async () => {
        setIsLoading(true);
        try {
            const data = await getAspectRatios();
            setRatios(data);
        } catch (error) {
            console.error('Failed to load aspect ratios:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) {
            setDraggedIndex(null);
            return;
        }

        const newRatios = [...ratios];
        const draggedItem = newRatios[draggedIndex];
        newRatios.splice(draggedIndex, 1);
        newRatios.splice(index, 0, draggedItem);

        setRatios(newRatios);
        setDraggedIndex(null);

        // Persist order to user settings
        if (user) {
            const newOrder = newRatios.map(r => r.id);
            try {
                await updateUserProfile(user.id, {
                    settings: {
                        ...user.settings,
                        aspectRatioOrder: newOrder
                    }
                });
            } catch (error) {
                console.error('Failed to save aspect ratio order:', error);
            }
        }
    };

    const handleOpenForm = (ratio?: AspectRatio) => {
        if (ratio) {
            setEditingRatio(ratio);
            setName(ratio.name);
            setValue(ratio.value);
            setPrimaryUseCase(ratio.primaryUseCase || '');
            setVisualFeel(ratio.visualFeel || '');
            setIsDefault(ratio.isDefault || false);
            setImageDefaultAR(ratio.imageDefaultAR || false);
            setVideoDefaultAR(ratio.videoDefaultAR || false);
            setIsSystem(ratio.isSystem || false);
        } else {
            setEditingRatio(null);
            setName('');
            setValue('');
            setPrimaryUseCase('');
            setVisualFeel('');
            setIsDefault(false);
            setImageDefaultAR(false);
            setVideoDefaultAR(false);
            setIsSystem(isAdmin); // Default to system for admins
        }
        setIsFormModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim() || !value.trim()) return;

        try {
            let result;
            if (editingRatio) {
                result = await updateAspectRatio(editingRatio.id, {
                    name,
                    value,
                    primaryUseCase,
                    visualFeel,
                    isDefault,
                    imageDefaultAR,
                    videoDefaultAR
                });
            } else {
                result = await createAspectRatio({
                    name,
                    value,
                    primaryUseCase,
                    visualFeel,
                    isDefault,
                    imageDefaultAR,
                    videoDefaultAR,
                    isSystem
                });
            }

            if (result) {
                await loadRatios();
                setIsFormModalOpen(false);
            }
        } catch (error) {
            console.error('Failed to save aspect ratio:', error);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            await deleteAspectRatio(confirmDelete.id);
            await loadRatios();
            setConfirmDelete(null);
        } catch (error) {
            console.error('Failed to delete aspect ratio:', error);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Aspect Ratios</h2>
                <Button size="sm" onClick={() => handleOpenForm()}>+ Add Ratio</Button>
            </div>

            <div className={styles.defaultsSection}>
                <h3>Default Selection</h3>
                <div className={styles.defaultsGrid}>
                    <div className={styles.defaultGroup}>
                        <label>Default Image Ratio</label>
                        <select
                            value={user?.settings?.defaultAspectRatioImage || ''}
                            onChange={async (e) => {
                                const newId = e.target.value;
                                if (user) {
                                    // 1. Update User Profile
                                    await updateUserProfile(user.id, {
                                        settings: {
                                            ...user.settings,
                                            defaultAspectRatioImage: newId
                                        }
                                    });

                                    // 2. Sync AspectRatio records
                                    for (const ratio of ratios) {
                                        const isNewDefault = ratio.id === newId;
                                        if (ratio.imageDefaultAR !== isNewDefault) {
                                            await updateAspectRatio(ratio.id, { imageDefaultAR: isNewDefault });
                                        }
                                    }
                                    await loadRatios();
                                }
                            }}
                            className="input select"
                        >
                            <option value="">Auto-Detect</option>
                            {ratios.map(ratio => (
                                <option key={ratio.id} value={ratio.id}>
                                    {ratio.name} ({ratio.value})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.defaultGroup}>
                        <label>Default Video Ratio</label>
                        <select
                            value={user?.settings?.defaultAspectRatioVideo || ''}
                            onChange={async (e) => {
                                const newId = e.target.value;
                                if (user) {
                                    // 1. Update User Profile
                                    await updateUserProfile(user.id, {
                                        settings: {
                                            ...user.settings,
                                            defaultAspectRatioVideo: newId
                                        }
                                    });

                                    // 2. Sync AspectRatio records
                                    for (const ratio of ratios) {
                                        const isNewDefault = ratio.id === newId;
                                        if (ratio.videoDefaultAR !== isNewDefault) {
                                            await updateAspectRatio(ratio.id, { videoDefaultAR: isNewDefault });
                                        }
                                    }
                                    await loadRatios();
                                }
                            }}
                            className="input select"
                        >
                            <option value="">Auto-Detect</option>
                            {ratios.map(ratio => (
                                <option key={ratio.id} value={ratio.id}>
                                    {ratio.name} ({ratio.value})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <p className={styles.helperText}>
                    These will be pre-selected when opening the generation modals.
                </p>
            </div>

            <div className={styles.ratioList}>
                {isLoading ? (
                    <div className={styles.emptyState}>Loading aspect ratios...</div>
                ) : ratios.length === 0 ? (
                    <div className={styles.emptyState}>No aspect ratios found. Create your first one!</div>
                ) : (
                    ratios.map((ratio, index) => (
                        <div
                            key={ratio.id}
                            className={`${styles.ratioItem} ${draggedIndex === index ? styles.dragging : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                        >
                            <div className={styles.dragHandle}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="9" cy="5" r="1" />
                                    <circle cx="9" cy="12" r="1" />
                                    <circle cx="9" cy="19" r="1" />
                                    <circle cx="15" cy="5" r="1" />
                                    <circle cx="15" cy="12" r="1" />
                                    <circle cx="15" cy="19" r="1" />
                                </svg>
                            </div>
                            <div className={styles.ratioInfo}>
                                <div className={styles.ratioNameRow}>
                                    <h3>{ratio.name}</h3>
                                    <span className={styles.valueBadge}>{ratio.value}</span>
                                    {ratio.isSystem && <span className={styles.systemBadge}>System</span>}
                                    {ratio.isDefault && <span className={styles.defaultBadge}>Default</span>}
                                    {ratio.imageDefaultAR && <span className={styles.defaultBadge}>Image Default</span>}
                                    {ratio.videoDefaultAR && <span className={styles.defaultBadge}>Video Default</span>}
                                </div>
                                <div className={styles.meta}>
                                    {ratio.primaryUseCase && <span>{ratio.primaryUseCase} • </span>}
                                    {ratio.visualFeel && <span>{ratio.visualFeel}</span>}
                                </div>
                            </div>
                            <div className={styles.actions}>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleOpenForm(ratio)}
                                    title="Edit"
                                >
                                    Edit
                                </Button>
                                <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => setConfirmDelete({ isOpen: true, id: ratio.id, name: ratio.name })}
                                    title="Delete"
                                >
                                    Del
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Form Modal */}
            <Modal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                title={editingRatio ? 'Edit Aspect Ratio' : 'New Aspect Ratio'}
            >
                <div className={styles.form}>
                    <div className={styles.inputRow}>
                        <div className={styles.formGroup}>
                            <label>Name</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Widescreen"
                                className="input"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Value</label>
                            <input
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                placeholder="e.g. 16:9"
                                className="input"
                            />
                        </div>
                    </div>
                    <div className={styles.formGroup}>
                        <label>Primary Use Case</label>
                        <input
                            value={primaryUseCase}
                            onChange={e => setPrimaryUseCase(e.target.value)}
                            placeholder="e.g. YouTube, TV, Monitors"
                            className="input"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Visual Feel</label>
                        <input
                            value={visualFeel}
                            onChange={e => setVisualFeel(e.target.value)}
                            placeholder="e.g. Modern, expansive"
                            className="input"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={isDefault}
                                onChange={e => setIsDefault(e.target.checked)}
                            />
                            <span>General Default</span>
                        </label>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={imageDefaultAR}
                                onChange={e => setImageDefaultAR(e.target.checked)}
                            />
                            <span>Default for Images</span>
                        </label>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={videoDefaultAR}
                                onChange={e => setVideoDefaultAR(e.target.checked)}
                            />
                            <span>Default for Videos</span>
                        </label>
                    </div>
                    {isAdmin && !editingRatio && (
                        <div className={styles.formGroup}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={isSystem}
                                    onChange={e => setIsSystem(e.target.checked)}
                                />
                                <span>Create as System record</span>
                            </label>
                        </div>
                    )}
                    <div className={styles.formActions}>
                        <Button variant="secondary" onClick={() => setIsFormModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!name.trim() || !value.trim()}>
                            {editingRatio ? 'Save Changes' : 'Create'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Delete Aspect Ratio"
                message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
            />
        </div>
    );
}
