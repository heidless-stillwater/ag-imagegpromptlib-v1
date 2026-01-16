'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PromptSet, PromptVersion, Category, Attachment, AspectRatio } from '@/types';
import { getPromptSetById, updatePromptSet, addVersion, updateVersion, deleteVersion } from '@/services/promptSets';
import { getCategories } from '@/services/categories';
import { getAverageRating, ratePromptSet, getUserRating } from '@/services/ratings';
import { generateImage, generateVideo, checkCache, ImageInput } from '@/services/gemini';
import { addMediaImage, checkMediaExists } from '@/services/media';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import StarRating from '@/components/ratings/StarRating';
import ShareModal from '@/components/shares/ShareModal';
import AttachmentPicker from '@/components/prompts/AttachmentPicker';
import AttachmentList from '@/components/prompts/AttachmentList';
import AspectRatioSelector from '@/components/common/AspectRatioSelector';
import styles from './page.module.css';

const BACKGROUND_STYLES = [
    { id: 'default', label: 'Default', description: '' },
    { id: 'dark', label: 'Dark', description: 'against a dark textured wall' },
    { id: 'nature', label: 'Nature', description: 'in a natural forest setting' },
    { id: 'urban', label: 'Urban', description: 'in a moody urban street set' },
    { id: 'studio', label: 'Studio', description: 'in a professional studio set with cinematic lighting' },
    { id: 'bokeh', label: 'Bokeh', description: 'with a heavily blurred cinematic bokeh background' },
];

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
    const [isAttachmentPickerOpen, setIsAttachmentPickerOpen] = useState(false);
    const [isEditVersionModalOpen, setIsEditVersionModalOpen] = useState(false);
    const [attachmentPickerTarget, setAttachmentPickerTarget] = useState<'new' | 'edit-version'>('new');

    // Form state
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editCategoryId, setEditCategoryId] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [newVersionPrompt, setNewVersionPrompt] = useState('');
    const [newVersionNotes, setNewVersionNotes] = useState('');
    const [newVersionAttachments, setNewVersionAttachments] = useState<Attachment[]>([]);
    const [editVersionPrompt, setEditVersionPrompt] = useState('');
    const [editVersionNotes, setEditVersionNotes] = useState('');
    const [editVersionAttachments, setEditVersionAttachments] = useState<Attachment[]>([]);
    const [newVersionBackgroundStyle, setNewVersionBackgroundStyle] = useState('default');
    const [editVersionBackgroundStyle, setEditVersionBackgroundStyle] = useState('default');

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState('');
    const [cachedImage, setCachedImage] = useState<string | null>(null);
    const [isBypassingCache, setIsBypassingCache] = useState(false);
    const [selectedBackgroundStyle, setSelectedBackgroundStyle] = useState('default');
    const [isVideoConfirmModalOpen, setIsVideoConfirmModalOpen] = useState(false);
    const [generatingVideo, setGeneratingVideo] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);
    const [videoError, setVideoError] = useState('');
    const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio | null>(null);

    // Rating state
    const [averageRating, setAverageRating] = useState({ average: 0, count: 0 });
    const [userRating, setUserRating] = useState(0);

    // Confirmation Modal states
    const [confirmAction, setConfirmAction] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'info' | 'success';
        confirmLabel?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const [feedback, setFeedback] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'info' | 'success' | 'danger';
    }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'info'
    });

    const [copyFeedback, setCopyFeedback] = useState(false);

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

    const handleCopyPrompt = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleAddVersion = async () => {
        if (!promptSet || !newVersionPrompt.trim()) return;

        const version = await addVersion(
            promptSet.id,
            newVersionPrompt,
            newVersionNotes,
            newVersionAttachments,
            newVersionBackgroundStyle
        );
        await loadData();
        if (version) {
            setSelectedVersion(version);
        }
        setIsVersionModalOpen(false);
        setNewVersionPrompt('');
        setNewVersionNotes('');
        setNewVersionAttachments([]);
        setNewVersionBackgroundStyle('default');
    };

    const handleDeleteVersion = (versionId: string) => {
        if (!promptSet) return;
        setConfirmAction({
            isOpen: true,
            title: 'Delete Version',
            message: 'Are you sure you want to delete this version? This action cannot be undone.',
            variant: 'danger',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                await deleteVersion(promptSet.id, versionId);
                await loadData();
                setSelectedVersion(null);
                setConfirmAction(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleOpenEditVersionModal = (version: PromptVersion) => {
        setEditVersionPrompt(version.promptText);
        setEditVersionNotes(version.notes || '');
        setEditVersionAttachments(version.attachments || []);
        setEditVersionBackgroundStyle(version.preferredBackgroundStyle || 'default');
        setIsEditVersionModalOpen(true);
    };

    const handleSaveVersionEdit = async () => {
        if (!promptSet || !selectedVersion || !editVersionPrompt.trim()) return;

        await updateVersion(promptSet.id, selectedVersion.id, {
            promptText: editVersionPrompt,
            notes: editVersionNotes,
            attachments: editVersionAttachments,
            preferredBackgroundStyle: editVersionBackgroundStyle,
        });

        await loadData();
        setIsEditVersionModalOpen(false);
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
        setSelectedAspectRatio(null); // Will be set by AspectRatioSelector to default

        // Check cache first
        const cached = await checkCache(version.promptText);
        setCachedImage(cached);
        setIsBypassingCache(false);
        setSelectedBackgroundStyle(version.preferredBackgroundStyle || 'default');
        setIsGenerateModalOpen(true);
    };

    // Helper to handle image uploads
    const processAndUploadImage = async (imageUrl: string) => {
        let finalImageUrl = imageUrl;

        // If it's a data URL (Base64), upload to Storage to avoid Firestore limits
        if (imageUrl.startsWith('data:')) {
            try {
                const timestamp = Date.now();
                const storagePath = `generated/${promptSet!.id}/${selectedVersion!.id}_${timestamp}.png`;
                const storageRef = ref(storage, storagePath);
                await uploadString(storageRef, imageUrl, 'data_url');
                finalImageUrl = await getDownloadURL(storageRef);
            } catch (storageErr) {
                console.error('Storage upload failed:', storageErr);
                throw new Error('Failed to upload generated image to storage.');
            }
        }
        return finalImageUrl;
    };

    const attachmentToImageInput = async (url: string): Promise<ImageInput | null> => {
        try {
            const trimmedUrl = url.trim();
            if (!trimmedUrl) {
                console.error('attachmentToImageInput: No URL provided');
                return null;
            }

            console.log('Converting attachment URL to ImageInput:', trimmedUrl);

            // If already a data URL, extract the base64 and mime type
            if (trimmedUrl.startsWith('data:')) {
                console.log('Detected data URL');
                const match = trimmedUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    return {
                        mimeType: match[1],
                        data: match[2],
                    };
                }
            }

            // Fetch the image and convert to base64
            console.log('Fetching attachment from:', trimmedUrl);
            const response = await fetch(trimmedUrl, {
                // Using 'cors' mode explicitly as these are usually external Firebase URLs
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) {
                console.error(`Fetch failed with status: ${response.status} (${response.statusText}) for URL: ${trimmedUrl}`);
                return null;
            }

            const blob = await response.blob();
            const mimeType = blob.type || 'image/png';
            console.log('Fetched blob size:', blob.size, 'type:', mimeType);

            // Use alternative base64 conversion if FileReader fails or for better compatibility
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result !== 'string') {
                        console.error('FileReader result is not a string');
                        resolve(null);
                        return;
                    }
                    const dataUrl = reader.result;
                    const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
                    if (base64Match) {
                        console.log('Successfully converted to base64');
                        resolve({
                            mimeType,
                            data: base64Match[1],
                        });
                    } else {
                        console.error('Failed to match base64 in dataUrl');
                        resolve(null);
                    }
                };
                reader.onerror = (e) => {
                    console.error('FileReader error:', e);
                    resolve(null);
                };
                try {
                    reader.readAsDataURL(blob);
                } catch (readErr) {
                    console.error('Error calling readAsDataURL:', readErr);
                    resolve(null);
                }
            });
        } catch (err) {
            console.error('Failed to convert attachment to ImageInput:', err);
            return null;
        }
    };

    const handleGenerate = async (mode: 'unsplash' | 'test' | 'live' = 'live') => {
        if (!selectedVersion || !promptSet) return;

        setIsGenerating(mode === 'test' ? false : true);
        setGenerateError('');
        const isTest = mode === 'test';

        try {
            // Convert attachments to ImageInput format for multimodal generation
            let images: ImageInput[] | undefined;
            if (selectedVersion.attachments && selectedVersion.attachments.length > 0 && mode === 'live') {
                const imagePromises = selectedVersion.attachments
                    .filter(a => a.type === 'image')
                    .map(a => attachmentToImageInput(a.url));
                const results = await Promise.all(imagePromises);
                images = results.filter((img): img is ImageInput => img !== null);
            }

            const result = await generateImage(
                selectedVersion.promptText,
                mode,
                isBypassingCache,
                user?.settings?.geminiApiKey,
                images,
                selectedBackgroundStyle !== 'default' ? BACKGROUND_STYLES.find(s => s.id === selectedBackgroundStyle)?.description : undefined,
                selectedAspectRatio?.value
            );

            if (result.success) {
                if (isTest) {
                    setFeedback({
                        isOpen: true,
                        title: 'Connection Verified',
                        message: 'Connection verified successfully! (Zero tokens used)',
                        variant: 'success'
                    });
                    setIsGenerateModalOpen(false);
                } else if (result.imageUrl) {

                    // Process image (upload if needed)
                    const finalImageUrl = await processAndUploadImage(result.imageUrl);

                    // Update version with image URL (storage or external)
                    await updateVersion(promptSet.id, selectedVersion.id, {
                        imageUrl: finalImageUrl,
                        imageGeneratedAt: new Date().toISOString(),
                    });

                    // NEW: Automatically save attachments to Media library
                    if (selectedVersion.attachments && selectedVersion.attachments.length > 0) {
                        try {
                            const imageAttachments = selectedVersion.attachments.filter(a => a.type === 'image');
                            if (imageAttachments.length > 0) {
                                console.log(`Auto-saving ${imageAttachments.length} attachments to media...`);
                                await Promise.all(imageAttachments.map(attachment =>
                                    addMediaImage(attachment.url, {
                                        promptSetId: promptSet.id,
                                        versionId: selectedVersion.id
                                    })
                                ));
                            }
                        } catch (saveErr) {
                            console.error('Failed to auto-save attachments to media:', saveErr);
                            // We don't block the main flow if auto-save fails
                        }
                    }

                    await loadData();
                    setIsGenerateModalOpen(false);
                }
            } else {
                setGenerateError(result.error || 'Failed to generate image');
            }
        } catch (err) {
            console.error('Generation flow error:', err);
            setGenerateError(err instanceof Error ? err.message : 'An unexpected error occurred during generation.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!selectedVersion) return;

        setGeneratingVideo(true);
        setVideoProgress(0);
        setVideoError('');
        setIsVideoConfirmModalOpen(false);

        try {
            const result = await generateVideo(
                selectedVersion.promptText,
                user?.settings?.geminiApiKey,
                selectedAspectRatio?.value,
                (progress: number) => setVideoProgress(progress)
            );

            if (result.success && result.videoUrl) {
                await updateVersion(promptSetId as string, selectedVersion.id, {
                    videoUrl: result.videoUrl,
                    videoGeneratedAt: new Date().toISOString(),
                    tags: ['veo 3', 'video']
                });
                await loadData();
            } else {
                setVideoError(result.error || 'Failed to generate video');
            }
        } catch (error) {
            console.error('Video generation error:', error);
            setVideoError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setGeneratingVideo(false);
        }
    };

    const handleRemoveVideo = async () => {
        if (!selectedVersion || !promptSet) return;

        setConfirmAction({
            isOpen: true,
            title: 'Remove Video',
            message: 'Are you sure you want to remove this video from the version?',
            variant: 'danger',
            confirmLabel: 'Remove',
            onConfirm: async () => {
                setConfirmAction(prev => ({ ...prev, isOpen: false }));
                try {
                    await updateVersion(promptSetId as string, selectedVersion.id, {
                        videoUrl: undefined,
                        videoGeneratedAt: undefined,
                    });
                    await loadData();
                } catch (error) {
                    console.error('Failed to remove video:', error);
                }
            }
        });
    };

    const handleRemoveImage = () => {
        if (!selectedVersion || !promptSet) return;

        setConfirmAction({
            isOpen: true,
            title: 'Remove Image',
            message: 'Are you sure you want to remove this image from the version?',
            variant: 'danger',
            confirmLabel: 'Remove',
            onConfirm: async () => {
                setConfirmAction(prev => ({ ...prev, isOpen: false }));
                try {
                    await updateVersion(promptSet.id, selectedVersion.id, {
                        imageUrl: undefined,
                        imageGeneratedAt: undefined,
                    });
                    await loadData();
                } catch (error) {
                    console.error('Failed to remove image:', error);
                    setFeedback({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to remove image. Please try again.',
                        variant: 'danger'
                    });
                }
            }
        });
    };

    const handleSaveToMedia = async (force: boolean = false) => {
        if (!selectedVersion || !promptSet || !selectedVersion.imageUrl) return;

        try {
            if (!force) {
                const exists = await checkMediaExists(selectedVersion.imageUrl);
                if (exists) {
                    setConfirmAction({
                        isOpen: true,
                        title: 'Image Already in Media',
                        message: 'This image is already in your media library. Do you want to replace the existing entry with updated metadata?',
                        variant: 'info',
                        confirmLabel: 'Replace',
                        onConfirm: () => handleSaveToMedia(true)
                    });
                    return;
                }
            }

            // Perform save
            await addMediaImage(selectedVersion.imageUrl, {
                promptSetId: promptSet.id,
                versionId: selectedVersion.id
            }, force);

            setConfirmAction(prev => ({ ...prev, isOpen: false }));
            setFeedback({
                isOpen: true,
                title: 'Success',
                message: 'Image saved to media library.',
                variant: 'success'
            });
        } catch (error) {
            console.error('Failed to save to media:', error);
            setFeedback({
                isOpen: true,
                title: 'Error',
                message: 'Failed to save image to media library.',
                variant: 'danger'
            });
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

    const handleOpenAddVersionModal = () => {
        if (promptSet && promptSet.versions.length > 0) {
            // Prefill with the latest version's text
            const latestVersion = promptSet.versions[promptSet.versions.length - 1];
            setNewVersionPrompt(latestVersion.promptText);
        } else {
            setNewVersionPrompt('');
        }
        setNewVersionNotes('');
        setNewVersionAttachments([]);
        setNewVersionBackgroundStyle('default');
        setIsVersionModalOpen(true);
    };

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
                        <Button size="sm" onClick={handleOpenAddVersionModal}>+ Add</Button>
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
                                            onClick={() => handleOpenEditVersionModal(selectedVersion)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handlePrepareGenerate(selectedVersion)}
                                        >
                                            🎨 Generate Image
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => setIsVideoConfirmModalOpen(true)}
                                            disabled={generatingVideo}
                                        >
                                            {generatingVideo ? (
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span className={styles.btnSpinner} />
                                                    {videoProgress > 0 ? `Generating (${videoProgress}%)` : 'Processing...'}
                                                </div>
                                            ) : (
                                                <>📹 Generate Video</>
                                            )}
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

                                {selectedVersion.tags && selectedVersion.tags.length > 0 && (
                                    <div className={styles.tagContainer}>
                                        {selectedVersion.tags.map(tag => (
                                            <span key={tag} className={styles.tag}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className={styles.promptBox}>
                                    <div className={styles.promptHeader}>
                                        <label>Prompt</label>
                                        <button
                                            className={styles.copyBtn}
                                            onClick={() => handleCopyPrompt(selectedVersion.promptText)}
                                            title="Copy full prompt"
                                        >
                                            {copyFeedback ? '✓ Copied!' : '📋 Copy'}
                                        </button>
                                    </div>
                                    <p>{selectedVersion.promptText}</p>
                                </div>

                                {selectedVersion.notes && (
                                    <div className={styles.notesBox}>
                                        <label>Notes</label>
                                        <p>{selectedVersion.notes}</p>
                                    </div>
                                )}

                                {selectedVersion.attachments && selectedVersion.attachments.length > 0 && (
                                    <div className={styles.attachmentsBox}>
                                        <AttachmentList
                                            attachments={selectedVersion.attachments}
                                            readonly
                                        />
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
                                                onClick={() => handleSaveToMedia()}
                                            >
                                                💾 Save to Media
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => handlePrepareGenerate(selectedVersion)}
                                            >
                                                Replace Image
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={handleRemoveImage}
                                            >
                                                Remove Image
                                            </Button>
                                        </div>
                                        <span className={styles.imageCaption}>
                                            Generated {selectedVersion.imageGeneratedAt
                                                ? new Date(selectedVersion.imageGeneratedAt).toLocaleString()
                                                : ''}
                                        </span>
                                    </div>
                                )}

                                {selectedVersion.videoUrl && (
                                    <div className={styles.imageBox}>
                                        <label>Generated Video</label>
                                        <video
                                            src={selectedVersion.videoUrl}
                                            controls
                                            className={styles.generatedImage}
                                            style={{ maxHeight: '400px' }}
                                        />
                                        <div className={styles.imageActions}>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={handleRemoveVideo}
                                            >
                                                Remove Video
                                            </Button>
                                        </div>
                                        <span className={styles.imageCaption}>
                                            Generated {selectedVersion.videoGeneratedAt
                                                ? new Date(selectedVersion.videoGeneratedAt).toLocaleString()
                                                : ''}
                                        </span>
                                    </div>
                                )}

                                {videoError && (
                                    <div className={styles.error} style={{ marginTop: '1rem' }}>
                                        {videoError}
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
                            placeholder="Enter your prompt... Use {{file:name}} to reference attachments"
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
                    <div className={styles.formGroup}>
                        <label>Background Style</label>
                        <select
                            value={newVersionBackgroundStyle}
                            onChange={e => setNewVersionBackgroundStyle(e.target.value)}
                            className="input select"
                        >
                            {BACKGROUND_STYLES.map(style => (
                                <option key={style.id} value={style.id}>
                                    {style.label} {style.description ? ` - ${style.description}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <div className={styles.attachmentsHeader}>
                            <label>Attachments</label>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                    setAttachmentPickerTarget('new');
                                    setIsAttachmentPickerOpen(true);
                                }}
                            >
                                + Attach File
                            </Button>
                        </div>
                        <AttachmentList
                            attachments={newVersionAttachments}
                            onRemove={(id) => setNewVersionAttachments(prev => prev.filter(a => a.id !== id))}
                        />
                    </div>
                    <div className={styles.formActions}>
                        <Button variant="secondary" onClick={() => setIsVersionModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddVersion} disabled={!newVersionPrompt.trim()}>Add Version</Button>
                    </div>
                </div>
            </Modal>

            {/* Edit Version Modal */}
            <Modal isOpen={isEditVersionModalOpen} onClose={() => setIsEditVersionModalOpen(false)} title="Edit Version">
                <div className={styles.form}>
                    <div className={styles.formGroup}>
                        <label>Prompt Text *</label>
                        <textarea
                            value={editVersionPrompt}
                            onChange={e => setEditVersionPrompt(e.target.value)}
                            className="input textarea"
                            rows={5}
                            placeholder="Enter your prompt... Use {{file:name}} to reference attachments"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Notes</label>
                        <textarea
                            value={editVersionNotes}
                            onChange={e => setEditVersionNotes(e.target.value)}
                            className="input textarea"
                            placeholder="Any notes about this version..."
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Background Style</label>
                        <select
                            value={editVersionBackgroundStyle}
                            onChange={e => setEditVersionBackgroundStyle(e.target.value)}
                            className="input select"
                        >
                            {BACKGROUND_STYLES.map(style => (
                                <option key={style.id} value={style.id}>
                                    {style.label} {style.description ? ` - ${style.description}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <div className={styles.attachmentsHeader}>
                            <label>Attachments</label>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                    setAttachmentPickerTarget('edit-version');
                                    setIsAttachmentPickerOpen(true);
                                }}
                            >
                                + Attach File
                            </Button>
                        </div>
                        <AttachmentList
                            attachments={editVersionAttachments}
                            onRemove={(id) => setEditVersionAttachments(prev => prev.filter(a => a.id !== id))}
                        />
                    </div>
                    <div className={styles.formActions}>
                        <Button variant="secondary" onClick={() => setIsEditVersionModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveVersionEdit} disabled={!editVersionPrompt.trim()}>Save Changes</Button>
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
                                <Button variant="secondary" onClick={() => {
                                    setCachedImage(null);
                                    setIsBypassingCache(true);
                                }}>Generate New</Button>
                                <Button variant="secondary" onClick={() => setIsGenerateModalOpen(false)}>Cancel</Button>
                                <Button onClick={async () => {
                                    if (selectedVersion && promptSet) {
                                        // Process image (upload if needed)
                                        const finalImageUrl = await processAndUploadImage(cachedImage);

                                        await updateVersion(promptSet.id, selectedVersion.id, {
                                            imageUrl: finalImageUrl,
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
                            <div className={styles.warning} style={{ marginBottom: 'var(--space-4)' }}>
                                <p><strong>This will make an API call to Gemini.</strong></p>
                                <p>Please confirm you want to generate an image with the following prompt:</p>
                            </div>

                            <div className={styles.formGroup} style={{ marginBottom: 'var(--space-4)' }}>
                                <label style={{ marginBottom: 'var(--space-1)', display: 'block', fontSize: 'var(--font-sm)', fontWeight: '500' }}>
                                    Background Style
                                </label>
                                <select
                                    value={selectedBackgroundStyle}
                                    onChange={e => setSelectedBackgroundStyle(e.target.value)}
                                    className="input select"
                                    style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-alt)', color: 'var(--color-text)' }}
                                >
                                    {BACKGROUND_STYLES.map(style => (
                                        <option key={style.id} value={style.id}>
                                            {style.label} {style.description ? ` - ${style.description}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.formGroup} style={{ marginBottom: 'var(--space-6)' }}>
                                <AspectRatioSelector
                                    selectedId={selectedAspectRatio?.id}
                                    defaultId={user?.settings?.defaultAspectRatioImage}
                                    onSelect={setSelectedAspectRatio}
                                    cols={3}
                                />
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
            {/* Confirmation and Feedback Modals */}
            <ConfirmationModal
                isOpen={confirmAction.isOpen}
                onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmAction.onConfirm}
                title={confirmAction.title}
                message={confirmAction.message}
                variant={confirmAction.variant}
                confirmLabel={confirmAction.confirmLabel}
            />

            <ConfirmationModal
                isOpen={feedback.isOpen}
                onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
                title={feedback.title}
                message={feedback.message}
                variant={feedback.variant}
                confirmLabel="Got It.."
                cancelLabel=""
            />

            {/* Attachment Picker Modal */}
            {isAttachmentPickerOpen && (
                <AttachmentPicker
                    existingAttachments={attachmentPickerTarget === 'new' ? newVersionAttachments : editVersionAttachments}
                    onAdd={(attachment) => {
                        if (attachmentPickerTarget === 'new') {
                            setNewVersionAttachments(prev => [...prev, attachment]);
                        } else if (attachmentPickerTarget === 'edit-version') {
                            setEditVersionAttachments(prev => [...prev, attachment]);
                        }
                    }}
                    onClose={() => setIsAttachmentPickerOpen(false)}
                />
            )}

            {/* Confirmation Modal for Video */}
            <ConfirmationModal
                isOpen={isVideoConfirmModalOpen}
                onClose={() => setIsVideoConfirmModalOpen(false)}
                onConfirm={handleGenerateVideo}
                title="Generate Video with Veo 3"
                message={
                    <div>
                        <p>Are you sure you want to generate a video using Veo 3?</p>
                        <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>Prompt:</p>
                        <p style={{ fontStyle: 'italic', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                            {selectedVersion?.promptText}
                        </p>
                        <p style={{ marginTop: '0.5rem', fontSize: 'var(--font-xs)', opacity: 0.7 }}>
                            This will use the <code>veo-3.1-fast-generate-preview</code> model.
                        </p>
                        <div style={{ marginTop: '1.5rem' }}>
                            <AspectRatioSelector
                                selectedId={selectedAspectRatio?.id}
                                defaultId={user?.settings?.defaultAspectRatioVideo}
                                onSelect={setSelectedAspectRatio}
                                cols={3}
                            />
                        </div>
                    </div>
                }
                variant="success"
                confirmLabel="Generate Video"
                size="md"
            />
        </div>
    );
}
