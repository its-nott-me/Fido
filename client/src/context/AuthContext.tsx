import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { env } from '../../loadenv';
import api from '../axios/axios.ts';

interface User {
    id: number;
    username: string;
    profileImageUrl?: string | null;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (userData: User, token: string) => void;
    logout: () => void;
    updateProfileImage: (url: string) => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('token');

        if (savedUser && savedToken) {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            setToken(savedToken);
            // Verify/refresh user data from backend
            fetchUserProfile(savedToken, parsedUser);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUserProfile = async (authToken: string, currentUser: User) => {
        try {
            const response = await api.get(`${env.API_URL}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            const fullUser = await response.data;
            setUser(fullUser);
            localStorage.setItem('user', JSON.stringify(fullUser));
        } catch (err) {
            console.error('Failed to fetch profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const login = (userData: User, authToken: string) => {
        setUser(userData);
        setToken(authToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', authToken);
        fetchUserProfile(authToken, userData);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    };

    const updateProfileImage = (url: string) => {
        if (user) {
            const updatedUser = { ...user, profileImageUrl: url };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, updateProfileImage, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
