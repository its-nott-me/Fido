import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './ProfileSettings.css';

interface ProfileSettingsProps {
    onClose: () => void;
}

export default function ProfileSettings({ onClose }: ProfileSettingsProps) {
    const { user, token, updateProfileImage } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(user?.profileImageUrl || null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Upload
        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('http://localhost:3001/api/auth/profile-image', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                updateProfileImage(data.profileImageUrl);
            } else {
                alert('Failed to upload image');
            }
        } catch (err) {
            console.error('Upload error:', err);
            alert('Error uploading image');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="profile-settings-overlay">
            <div className="profile-settings-card glass-module">
                <h2>PROFILE</h2>
                <div className="profile-avatar-section">
                    <div className="avatar-preview">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Profile" />
                        ) : (
                            <div className="avatar-placeholder">{user?.username?.[0]?.toUpperCase()}</div>
                        )}
                    </div>
                    <label className="upload-label">
                        {uploading ? 'UPLOADING...' : 'CHANGE IMAGE'}
                        <input type="file" accept="image/*" onChange={handleFileChange} hidden disabled={uploading} />
                    </label>
                </div>
                <div className="profile-info-section">
                    <div className="info-row">
                        <span>USERNAME</span>
                        <span>{user?.username}</span>
                    </div>
                </div>
                <button className="nav-btn-primary close-btn" onClick={onClose}>CLOSE</button>
            </div>
        </div>
    );
}
