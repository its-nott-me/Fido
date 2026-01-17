import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { env } from '../loadEnv.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { uploadToR2, getMediaUrl, getTotalBucketSize, deleteObjectFromR2 } from '../r2/cloudflare.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if user exists
        const userExists = await query('SELECT * FROM users WHERE username = $1', [username]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insert user
        const newUser = await query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, passwordHash]
        );

        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await query('SELECT * FROM users WHERE username = $1', [username]);
        if (user.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Create JWT
        const token = jwt.sign(
            { id: user.rows[0].id, username: user.rows[0].username },
            env.jwtSecret,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.rows[0].id,
                username: user.rows[0].username
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get current user
router.get('/me', verifyToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT id, username, profile_image_key FROM users WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = result.rows[0];
        let profileImageUrl = null;
        if (user.profile_image_key) {
            profileImageUrl = await getMediaUrl(user.profile_image_key);
        }
        res.json({
            id: user.id,
            username: user.username,
            profileImageUrl: profileImageUrl
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Upload profile image
router.post('/profile-image', verifyToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // check Storage Limit
        const currentSize = await getTotalBucketSize();
        const limit = 9 * 1024 * 1024 * 1024;
        if (currentSize >= limit) {
            return res.status(400).json({ error: "Storage limit reached. Cannot upload more files." });
        }

        const ext = req.file.originalname.split('.').pop();
        const filename = `profile_${req.user.id}_${Date.now()}.${ext}`;

        // Fetch old image key to delete it later
        const userRes = await query('SELECT profile_image_key FROM users WHERE id = $1', [req.user.id]);
        const oldKey = userRes.rows[0]?.profile_image_key;

        await uploadToR2(filename, req.file.buffer, req.file.mimetype);

        await query(
            'UPDATE users SET profile_image_key = $1 WHERE id = $2',
            [filename, req.user.id]
        );

        if (oldKey) {
            try {
                await deleteObjectFromR2(oldKey);
            } catch (delErr) {
                console.warn(`Failed to delete old profile image ${oldKey}:`, delErr.message);
            }
        }

        const profileImageUrl = await getMediaUrl(filename);
        res.json({ profileImageUrl });
    } catch (error) {
        console.error('Profile image upload error:', error);
        const errorMessage = error.message.includes("Storage limit reached")
            ? error.message
            : 'Failed to upload profile image';
        res.status(error.message.includes("Storage limit reached") ? 400 : 500).json({ error: errorMessage });
    }
});

export default router;
