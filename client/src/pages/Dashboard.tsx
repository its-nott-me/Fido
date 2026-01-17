import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Upload from '../components/Upload';
import Gallery from '../components/Gallery';
import SyncPlay from '../components/SyncPlay';
import './Dashboard.css';

export default function Dashboard() {
    const { user } = useAuth();
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleUploadSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    if (!user) {
        return (
            <div className="dashboard-auth-notice">
                <div className="glass-module notice-card">
                    <h2>Access Denied</h2>
                    <p>Please login to access your dashboard and gallery.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <header className="dashboard-header-section">
                <div className="header-info">
                    <h1>Control Center</h1>
                    <p>Manage your media gallery</p>
                </div>
            </header>

            <main className="dashboard-grid">
                <div className="dashboard-sidebar">
                    <SyncPlay />
                </div>

                <div className="dashboard-main-content">
                    <div className="glass-module collection-card">
                        <div className="card-header">
                            <h3 className="section-title">Your Media Collection</h3>
                            <Upload onUploadSuccess={handleUploadSuccess} />
                        </div>
                        <div className="gallery-container">
                            <Gallery refreshTrigger={refreshTrigger} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
