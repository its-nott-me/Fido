import { useState, useRef } from 'react';
import axios from '../axios/axios';
import { useAuth } from '../context/AuthContext';
import './Upload.css';

export default function Upload({ onUploadSuccess }: { onUploadSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const targetProgress = useRef(0);
    const rafRef = useRef<number | null>(null); // request animation frame --> raf
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { token } = useAuth();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError('');
        }
    };

    const resetInput = () => {
        setFile(null);
        setProgress(0);
        setError('');
        if(fileInputRef.current){
            fileInputRef.current.value = '';
        }
    };

    const startProgressAnimation = () => {
        if (rafRef.current) return;

        const animate = () => {
            setProgress(prev => {
                const diff = targetProgress.current - prev;
                if (Math.abs(diff) < 0.1) {
                    return targetProgress.current;
                }
                return prev + diff * 0.15; // easing factor
            });

            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);
    };

    const stopProgressAnimation = () => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError("");

    try {
        await axios.post("/media/upload", file, {
        headers: {
            "Content-Type": file.type,
            "Content-Length": file.size,
            Authorization: `Bearer ${token}`,
            "X-Filename": file.name,
        },
        onUploadProgress: (e) => {
            if (!e.total) return;
            targetProgress.current = Math.min(
                Math.round((e.loaded / e.total) * 100),
                95
            );
            startProgressAnimation();
        },
        });

        targetProgress.current = 100;
        setProgress(100);
        onUploadSuccess();
        resetInput();

    } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.error || "Upload failed");
    } finally {
        stopProgressAnimation();
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
                            <button onClick={resetInput} className="btn-cancel">
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
