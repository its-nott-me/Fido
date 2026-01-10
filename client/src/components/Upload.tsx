import { useState, useRef } from 'react';
import axios from '../axios/axios';
import { useAuth } from '../context/AuthContext';

export default function Upload({ onUploadSuccess }: { onUploadSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { token } = useAuth();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setProgress(0);
        setError('');

        const formData = new FormData();
        formData.append('media', file);

        try {
            await axios.post('/media/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
                    setProgress(percentCompleted);
                }
            });

            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            onUploadSuccess();
            alert('Upload successful!');
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.response?.data?.error || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{
            padding: '1.5rem',
            backgroundColor: 'rgba(30, 41, 59, 0.3)',
            borderRadius: '20px',
            border: '1px dashed rgba(255, 255, 255, 0.2)',
            textAlign: 'center'
        }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Upload Media</h3>

            <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: 'none' }}
            />

            {!file ? (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    Select Video File
                </button>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', wordBreak: 'break-all' }}>
                        {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>

                    {uploading ? (
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#3b82f6', transition: 'width 0.2s' }} />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                                onClick={handleUpload}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Start Upload
                            </button>
                            <button
                                onClick={() => setFile(null)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: 'transparent',
                                    color: '#ef4444',
                                    border: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <p style={{ marginTop: '1rem', color: '#f87171', fontSize: '0.75rem' }}>{error}</p>
            )}
        </div>
    );
}
