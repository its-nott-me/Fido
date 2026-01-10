import { useEffect, useState } from 'react';
import axios from '../axios/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Media {
    id: number;
    filename: string;
    r2_key: string;
    created_at: string;
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
            // console.log(response.data)
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
            // console.log(media)
            const sessionId = `session-${Math.random().toString(36).substr(2, 9)}`;
            navigate(`/room/${sessionId}?mediaId=${media.r2_key}`);
        }
    };

    return (
        <div style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Your Gallery</h3>

            {loading ? (
                <div style={{ textAlign: 'center', color: '#475569', padding: '2rem' }}>Loading collection...</div>
            ) : medias.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#475569', padding: '2rem' }}>No media uploaded yet.</div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: '1rem',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    paddingRight: '0.5rem'
                }}>
                    {medias.map((media) => (
                        <div
                            key={media.id}
                            onClick={() => handleMediaSelect(media)}
                            style={{
                                padding: '1rem',
                                backgroundColor: 'rgba(15, 23, 42, 0.3)',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
                                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.3)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                            }}
                        >
                            <div style={{
                                width: '40px',
                                height: '40px',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#3b82f6'
                            }}>
                                🎬
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: '#d1d5db',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {media.filename}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {new Date(media.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
