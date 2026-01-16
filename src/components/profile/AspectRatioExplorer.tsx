'use client';

import { useState, useEffect } from 'react';
import { AspectRatio } from '@/types';
import {
    getAspectRatios,
    createAspectRatio,
    updateAspectRatio,
    deleteAspectRatio
} from '@/services/aspectRatios';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { useAuth } from '@/contexts/AuthContext';
import styles from './AspectRatioExplorer.module.css';

export default function AspectRatioExplorer() {
    const { isAdmin } = useAuth();
    const [ratios, setRatios] = useState<AspectRatio[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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

    const handleOpenForm = (ratio?: AspectRatio) => {
        if (ratio) {
            setEditingRatio(ratio);
            setName(ratio.name);
            setValue(ratio.value);
            setPrimaryUseCase(ratio.primaryUseCase || '');
            setVisualFeel(ratio.visualFeel || '');
            setIsDefault(ratio.isDefault);
            setIsSystem(ratio.isSystem);
        } else {
            setEditingRatio(null);
            setName('');
            setValue('');
            setPrimaryUseCase('');
            setVisualFeel('');
            setIsDefault(false);
            setIsSystem(isAdmin); // Default to system for admins
        }
        setIsFormModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim() || !value.trim()) return;

        try {
            if (editingRatio) {
                await updateAspectRatio(editingRatio.id, {
                    name,
                    value,
                    primaryUseCase,
                    visualFeel,
                    isDefault
                });
            } else {
                await createAspectRatio({
                    name,
                    value,
                    primaryUseCase,
                    visualFeel,
                    isDefault,
                    isSystem
                });
            }
            await loadRatios();
            setIsFormModalOpen(false);
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

            <div className={styles.ratioList}>
                {isLoading ? (
                    <div className={styles.emptyState}>Loading aspect ratios...</div>
                ) : ratios.length === 0 ? (
                    <div className={styles.emptyState}>No aspect ratios found. Create your first one!</div>
                ) : (
                    ratios.map(ratio => (
                        <div key={ratio.id} className={styles.ratioItem}>
                            <div className={styles.ratioInfo}>
                                <div className={styles.ratioNameRow}>
                                    <h3>{ratio.name}</h3>
                                    <span className={styles.valueBadge}>{ratio.value}</span>
                                    {ratio.isSystem && <span className={styles.systemBadge}>System</span>}
                                    {ratio.isDefault && <span className={styles.defaultBadge}>Default</span>}
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
                            <span>Set as default aspect ratio</span>
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
