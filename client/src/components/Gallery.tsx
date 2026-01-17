import { useEffect, useState } from 'react';
import axios from '../axios/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
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

type ThumbnailProps = {
    r2WorkerURL: string,
    thumbnailKey: string,
};

const Thumbnail: React.FC<ThumbnailProps> = ({ r2WorkerURL, thumbnailKey }) => {
    const [thumbnailBroken, setThumbnailBroken] = useState(false);

    if (thumbnailBroken) return <p>🎬</p>;

    return (
        <img
            src={`${r2WorkerURL}/${thumbnailKey}`}
            onError={() => setThumbnailBroken(true)}
            alt='Media Thumbnail'
        />
    )
}

export default function Gallery({ refreshTrigger = 0, onSelect }: GalleryProps) {
    const [medias, setMedias] = useState<Media[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteConfig, setDeleteConfig] = useState<{ show: boolean, media: Media | null }>({ show: false, media: null });
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

    const handleDeleteMedia = (e: React.MouseEvent, media: Media) => {
        e.stopPropagation();
        setDeleteConfig({ show: true, media });
    };

    const confirmDelete = async () => {
        if (!deleteConfig.media || !token) return;

        try {
            await axios.delete(`/media/${deleteConfig.media.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchMedias();
        } catch (err) {
            console.error('Failed to delete media:', err);
        } finally {
            setDeleteConfig({ show: false, media: null });
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
        <>
            <div className="gallery-grid">
                {medias.map((media) => (
                    <div
                        key={media.id}
                        onClick={() => handleMediaSelect(media)}
                        className="gallery-item glass-module"
                    >
                        <div className="media-thumbnail">
                            <Thumbnail
                                r2WorkerURL={r2WorkerURL}
                                thumbnailKey={media.thumbnail_key}
                            />
                        </div>
                        <div className="media-info">
                            <span className="media-name" title={media.filename}>
                                {media.filename}
                            </span>
                            <span className="media-date">
                                {new Date(media.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <button
                            className="delete-button"
                            onClick={(e) => handleDeleteMedia(e, media)}
                            title="Delete Media"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {deleteConfig.show && (
                <div className="modal-overlay" onClick={() => setDeleteConfig({ show: false, media: null })}>
                    <div className="modal-content glass-module" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <Trash2 size={24} className="modal-icon" />
                            <h3>Confirm Deletion</h3>
                        </div>
                        <p>
                            Are you sure you want to delete <b>{deleteConfig.media?.filename}</b>?
                            This action is permanent and cannot be reversed.
                        </p>
                        <div className="modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setDeleteConfig({ show: false, media: null })}
                            >
                                Abort
                            </button>
                            <button
                                className="nav-btn-primary btn-delete-confirm"
                                onClick={confirmDelete}
                            >
                                Confirm Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
