export const downloadFile = async (url: string, filename: string): Promise<void> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Download failed:', error);
        throw error;
    }
};

export const downloadFilesSequentially = async (
    files: { url: string; filename: string }[],
    onProgress?: (current: number, total: number) => void
): Promise<void> => {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            await downloadFile(file.url, file.filename);
            // Small delay to prevent browser from blocking multiple downloads
            await new Promise(resolve => setTimeout(resolve, 500));
            if (onProgress) {
                onProgress(i + 1, files.length);
            }
        } catch (error) {
            console.error(`Failed to download ${file.filename}:`, error);
            // Continue with next file even if one fails
        }
    }
};
