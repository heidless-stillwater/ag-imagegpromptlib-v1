'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PromptSet, PromptVersion, Category } from '@/types';
import { getPromptSetById, updatePromptSet, addVersion, updateVersion, deleteVersion } from '@/services/promptSets';
import { getCategories } from '@/services/categories';
import { getAverageRating, ratePromptSet, getUserRating } from '@/services/ratings';
import { generateImage, checkCache } from '@/services/gemini';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import StarRating from '@/components/ratings/StarRating';
import ShareModal from '@/components/shares/ShareModal';
import styles from './page.module.css';

export default function PromptDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAdmin } = useAuth();
    const promptSetId = params.id as string;

    const [promptSet, setPromptSet] = useState<PromptSet | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);

    // Modals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // Form state
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editCategoryId, setEditCategoryId] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [newVersionPrompt, setNewVersionPrompt] = useState('');
    const [newVersionNotes, setNewVersionNotes] = useState('');

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState('');
    const [cachedImage, setCachedImage] = useState<string | null>(null);

    // Rating state
    const [averageRating, setAverageRating] = useState({ average: 0, count: 0 });
    const [userRating, setUserRating] = useState(0);

    useEffect(() => {
        loadData();
    }, [promptSetId]);

    const loadData = async () => {
        try {
            const [set, cats] = await Promise.all([
                getPromptSetById(promptSetId),
                getCategories()
            ]);

            if (!set) {
                router.push('/dashboard');
                return;
            }

            setPromptSet(set);
            setCategories(cats);

            const [avgRating, rating] = await Promise.all([
                getAverageRating(promptSetId),
                getUserRating(promptSetId)
            ]);

            setAverageRating(avgRating);
            setUserRating(rating?.score || 0);

            // Refresh selected version data if it exists, otherwise default to latest
            if (selectedVersion) {
                const updated = set.versions.find(v => v.id === selectedVersion.id);
                if (updated) {
                    setSelectedVersion(updated);
                }
            } else if (set.versions.length > 0) {
                setSelectedVersion(set.versions[set.versions.length - 1]);
            }
        } catch (error) {
            console.error('Failed to load prompt detail data:', error);
        }
    };

    const handleEditPromptSet = () => {
        if (!promptSet) return;
        setEditTitle(promptSet.title);
        setEditDescription(promptSet.description || '');
        setEditCategoryId(promptSet.categoryId || '');
        setEditNotes(promptSet.notes || '');
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!promptSet || !editTitle.trim()) return;

        await updatePromptSet(promptSet.id, {
            title: editTitle,
            description: editDescription,
            categoryId: editCategoryId || undefined,
            notes: editNotes,
        });

        await loadData();
        setIsEditModalOpen(false);
    };

    const handleAddVersion = async () => {
        if (!promptSet || !newVersionPrompt.trim()) return;

        await addVersion(promptSet.id, newVersionPrompt, newVersionNotes);
        await loadData();
        setIsVersionModalOpen(false);
        setNewVersionPrompt('');
        setNewVersionNotes('');
    };

    const handleDeleteVersion = async (versionId: string) => {
        if (!promptSet) return;
        if (!confirm('Delete this version?')) return;

        await deleteVersion(promptSet.id, versionId);
        await loadData();
        setSelectedVersion(null);
    };

    const handleRating = async (score: number) => {
        await ratePromptSet(promptSetId, score);
        setUserRating(score);
        const avg = await getAverageRating(promptSetId);
        setAverageRating(avg);
    };

    const handlePrepareGenerate = async (version: PromptVersion) => {
        setSelectedVersion(version);
        setGenerateError('');

        // Check cache first
        const cached = await checkCache(version.promptText);
        setCachedImage(cached);
        setIsGenerateModalOpen(true);
    };

    const handleGenerate = async (mode: 'unsplash' | 'test' | 'live' = 'live') => {
        if (!selectedVersion || !promptSet) return;

        setIsGenerating(mode === 'test' ? false : true); // Show spinner for images, but maybe just button loading for test
        setGenerateError('');
        const isTest = mode === 'test';

        try {
            const result = await generateImage(selectedVersion.promptText, mode);

            if (result.success) {
                if (isTest) {
                    alert('NanoBanana connection verified successfully! (Zero tokens used)');
                    setIsGenerateModalOpen(false);
                } else if (result.imageUrl) {
                    // Update version with image
                    await updateVersion(promptSet.id, selectedVersion.id, {
                        imageUrl: result.imageUrl,
                        imageGeneratedAt: new Date().toISOString(),
                    });
                    await loadData();
                    setIsGenerateModalOpen(false);
                }
            } else {
                setGenerateError(result.error || 'Failed to generate image');
            }
        } catch (err) {
            setGenerateError('An unexpected error occurred during generation.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRemoveImage = async () => {
        if (!selectedVersion || !promptSet) return;
        if (!confirm('Are you sure you want to remove this image?')) return;

        try {
            await updateVersion(promptSet.id, selectedVersion.id, {
                imageUrl: undefined,
                imageGeneratedAt: undefined,
            });
            await loadData();
        } catch (error) {
            console.error('Failed to remove image:', error);
            alert('Failed to remove image. Please try again.');
        }
    };

    if (!promptSet) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner} />
            </div>
        );
    }

    const category = categories.find(c => c.id === promptSet.categoryId);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>
                    ← Back
                </button>

                <div className={styles.headerContent}>
                    <div className={styles.titleRow}>
                        <h1 className={styles.title}>{promptSet.title}</h1>
                        {category && <span className={styles.categoryBadge}>{category.name}</span>}
                    </div>

                    {promptSet.description && (
                        <p className={styles.description}>{promptSet.description}</p>
                    )}

                    <div className={styles.meta}>
                        <span>{promptSet.versions.length} version{promptSet.versions.length !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <StarRating
                            value={averageRating.average}
                            readonly
                            size="sm"
                            count={averageRating.count}
                        />
                    </div>
                </div>

                <div className={styles.headerActions}>
                    <Button variant="secondary" onClick={handleEditPromptSet}>Edit</Button>
                    <Button variant="secondary" onClick={() => setIsShareModalOpen(true)}>Share</Button>
                </div>
            </div>

            <div className={styles.content}>
                <div className={styles.versionsPanel}>
                    <div className={styles.panelHeader}>
                        <h2>Versions</h2>
                        <Button size="sm" onClick={() => setIsVersionModalOpen(true)}>+ Add</Button>
                    </div>

                    <div className={styles.versionsList}>
                        {promptSet.versions.map(version => (
                            <div
                                key={version.id}
                                className={`${styles.versionItem} ${selectedVersion?.id === version.id ? styles.selected : ''}`}
                                onClick={() => setSelectedVersion(version)}
                            >
                                <div className={styles.versionHeader}>
                                    <span className={styles.versionNumber}>v{version.versionNumber}</span>
                                    {version.imageUrl && <span className={styles.hasImage}>🖼️</span>}
                                </div>
                                <p className={styles.versionPreview}>{version.promptText.substring(0, 80)}...</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.detailPanel}>
                    {selectedVersion ? (
                        <>
                            <div className={styles.versionDetail}>
                                <div className={styles.versionDetailHeader}>
                                    <h3>Version {selectedVersion.versionNumber}</h3>
                                    <div className={styles.versionActions}>
                                        <Button
                                            size="sm"
                                            onClick={() => handlePrepareGenerate(selectedVersion)}
                                        >
                                            🎨 Generate Image
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() => handleDeleteVersion(selectedVersion.id)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>

                                <div className={styles.promptBox}>
                                    <label>Prompt</label>
                                    <p>{selectedVersion.promptText}</p>
                                </div>

                                {selectedVersion.notes && (
                                    <div className={styles.notesBox}>
                                        <label>Notes</label>
                                        <p>{selectedVersion.notes}</p>
                                    </div>
                                )}

                                {selectedVersion.imageUrl && (
                                    <div className={styles.imageBox}>
                                        <label>Generated Image</label>
                                        <img
                                            src={selectedVersion.imageUrl}
                                            alt="Generated"
                                            className={styles.generatedImage}
                                            onClick={() => setIsImageModalOpen(true)}
                                        />
                                        <div className={styles.imageActions}>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => handlePrepareGenerate(selectedVersion)}
                                            >
                                                Replace
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={handleRemoveImage}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                        <span className={styles.imageCaption}>
                                            Generated {selectedVersion.imageGeneratedAt
                                                ? new Date(selectedVersion.imageGeneratedAt).toLocaleString()
                                                : ''}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.ratingSection}>
                                <h4>Rate this prompt set</h4>
                                <StarRating value={userRating} onChange={handleRating} size="lg" />
                            </div>
                        </>
                    ) : (
                        <div className={styles.noVersion}>
                            <p>Select a version to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Prompt Set">
                <div className={styles.form}>
                    <div className={styles.formGroup}>
                        <label>Title</label>
                        <input
                            type="text"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="input"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Description</label>
                        <textarea
                            value={editDescription}
                            onChange={e => setEditDescription(e.target.value)}
                            className="input textarea"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Category</label>
                        <select
                            value={editCategoryId}
                            onChange={e => setEditCategoryId(e.target.value)}
                            className="input select"
                        >
                            <option value="">No category</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <label>Notes</label>
                        <textarea
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            className="input textarea"
                        />
                    </div>
                    <div className={styles.formActions}>
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveEdit}>Save Changes</Button>
                    </div>
                </div>
            </Modal>

            {/* Add Version Modal */}
            <Modal isOpen={isVersionModalOpen} onClose={() => setIsVersionModalOpen(false)} title="Add New Version">
                <div className={styles.form}>
                    <div className={styles.formGroup}>
                        <label>Prompt Text *</label>
                        <textarea
                            value={newVersionPrompt}
                            onChange={e => setNewVersionPrompt(e.target.value)}
                            className="input textarea"
                            rows={5}
                            placeholder="Enter your prompt..."
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Notes</label>
                        <textarea
                            value={newVersionNotes}
                            onChange={e => setNewVersionNotes(e.target.value)}
                            className="input textarea"
                            placeholder="Any notes about this version..."
                        />
                    </div>
                    <div className={styles.formActions}>
                        <Button variant="secondary" onClick={() => setIsVersionModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddVersion} disabled={!newVersionPrompt.trim()}>Add Version</Button>
                    </div>
                </div>
            </Modal>

            {/* Generate Confirmation Modal */}
            <Modal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} title="⚠️ Generate Image">
                <div className={styles.generateModal}>
                    {cachedImage ? (
                        <>
                            <div className={styles.cacheNotice}>
                                <span>✓</span>
                                <p>Found cached image for this prompt! Using cached version (no API call needed).</p>
                            </div>
                            <img src={cachedImage} alt="Cached" className={styles.previewImage} />
                            <div className={styles.formActions}>
                                <Button variant="secondary" onClick={() => setIsGenerateModalOpen(false)}>Cancel</Button>
                                <Button onClick={async () => {
                                    if (selectedVersion && promptSet) {
                                        await updateVersion(promptSet.id, selectedVersion.id, {
                                            imageUrl: cachedImage,
                                            imageGeneratedAt: new Date().toISOString(),
                                        });
                                        await loadData();
                                        setIsGenerateModalOpen(false);
                                    }
                                }}>Use Cached Image</Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={styles.warning}>
                                <p><strong>This will make an API call to Gemini.</strong></p>
                                <p>Please confirm you want to generate an image with the following prompt:</p>
                            </div>

                            <div className={styles.optionsGrid}>
                                <button
                                    className={styles.optionCard}
                                    onClick={() => handleGenerate('unsplash')}
                                    disabled={isGenerating}
                                >
                                    <span className={styles.optionIcon}>🖼️</span>
                                    <div className={styles.optionContent}>
                                        <span className={styles.optionTitle}>Unsplash Placeholder</span>
                                        <span className={styles.optionDesc}>Quick preview, no API cost</span>
                                    </div>
                                </button>

                                <button
                                    className={styles.optionCard}
                                    onClick={() => handleGenerate('test')}
                                    disabled={isGenerating}
                                >
                                    <span className={styles.optionIcon}>🔌</span>
                                    <div className={styles.optionContent}>
                                        <span className={styles.optionTitle}>Test Connection</span>
                                        <span className={styles.optionDesc}>Verify API (zero tokens)</span>
                                    </div>
                                </button>

                                <button
                                    className={`${styles.optionCard} ${styles.primaryOption}`}
                                    onClick={() => handleGenerate('live')}
                                    disabled={isGenerating}
                                >
                                    <span className={styles.optionIcon}>✨</span>
                                    <div className={styles.optionContent}>
                                        <span className={styles.optionTitle}>Submit Live</span>
                                        <span className={styles.optionDesc}>Actual AI generation</span>
                                    </div>
                                </button>
                            </div>

                            {generateError && (
                                <div className={styles.error}>{generateError}</div>
                            )}

                            <div className={styles.formActions}>
                                <Button variant="secondary" onClick={() => setIsGenerateModalOpen(false)}>Cancel</Button>
                                {isGenerating && <span className={styles.generatingState}>Generating...</span>}
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* Image Lightbox */}
            <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} size="lg">
                {selectedVersion?.imageUrl && (
                    <img
                        src={selectedVersion.imageUrl}
                        alt="Generated"
                        className={styles.lightboxImage}
                    />
                )}
            </Modal>

            {/* Share Modal */}
            {isShareModalOpen && (
                <ShareModal
                    promptSetId={promptSetId}
                    onClose={() => setIsShareModalOpen(false)}
                />
            )}
        </div>
    );
}
