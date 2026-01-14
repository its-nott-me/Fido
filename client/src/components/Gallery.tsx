import { useEffect, useState } from 'react';
import axios from '../axios/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Gallery.css';

interface Media {
    id: number;
    filename: string;
    r2_key: string;
    created_at: string;
    thumbnail_key: string;
}

interface GalleryProps {
    refreshTrigger?: number;
    onSelect?: (media: Media) => void;
}

export default function Gallery({ refreshTrigger = 0, onSelect }: GalleryProps) {
    const [medias, setMedias] = useState<Media[]>([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();
    const navigate = useNavigate();
    const r2WorkerURL = import.meta.env.VITE_R2_WORKER_URL;

    useEffect(() => {
        fetchMedias();
    }, [token, refreshTrigger]);

    const fetchMedias = async () => {
        if (!token) return;
        try {
            const response = await axios.get('/media/list', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMedias(response.data);
        } catch (err) {
            console.error('Failed to fetch media:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleMediaSelect = (media: Media) => {
        if (onSelect) {
            onSelect(media);
        } else {
            const sessionId = Math.random().toString(36).substr(2, 9);
            navigate(`/room/${sessionId}?mediaId=${media.r2_key}`);
        }
    };

    if (loading) return (
        <div className="gallery-status">
            <span className="loading-spinner"></span>
            Synchronizing data...
        </div>
    );

    if (medias.length === 0) return (
        <div className="gallery-status">
            Your personal server is empty.
        </div>
    );

    return (
        <div className="gallery-grid">
            {medias.map((media) => (
                <div
                    key={media.id}
                    onClick={() => handleMediaSelect(media)}
                    className="gallery-item glass-module"
                >
                    <div className="media-thumbnail">
                        <img src={`${r2WorkerURL}/${media.thumbnail_key}`}/>
                        {/* 🎬 */}
                    </div>
                    <div className="media-info">
                        <span className="media-name" title={media.filename}>
                            {media.filename}
                        </span>
                        <span className="media-date">
                            {new Date(media.created_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
