import { useState, useRef } from 'react';
import axios from '../axios/axios';
import { useAuth } from '../context/AuthContext';
import './Upload.css';

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
                    const percent = Math.round((progressEvent.loaded * 100) / (file.size || 100));
                    setProgress(Math.min(percent, 95));
                }
            })
            .then(() => setProgress(100));

            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            onUploadSuccess();
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.response?.data?.error || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="upload-container">
            <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: 'none' }}
            />

            {!file ? (
                <div className="upload-header" onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
                    {/* <div className="upload-icon">📤</div> */}
                    <p>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            style={{ marginRight: "8px" }}
                        >
                            <path d="M12 21a1 1 0 0 1-1-1V8.41l-3.29 3.3a1 1 0 1 1-1.42-1.42l5-5a1 1 0 0 1 1.42 0l5 5a1 1 0 0 1-1.42 1.42L13 8.41V20a1 1 0 0 1-1 1z" />
                            <path d="M5 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z" />
                        </svg>
                        Upload
                    </p>
                    {/* <p className="file-size">Click to browse your local storage</p> */}
                </div>
            ) : (
                <div className="upload-details">
                    <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                    </div>

                    {uploading ? (
                        <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                    ) : (
                        <div className="upload-actions">
                            <button onClick={handleUpload} className="nav-btn-primary btn-upload">
                                Start Transmission
                            </button>
                            <button onClick={() => setFile(null)} className="btn-cancel">
                                Abort
                            </button>
                        </div>
                    )}
                </div>
            )}

            {error && <div className="upload-error">{error}</div>}
        </div>
    );
}
