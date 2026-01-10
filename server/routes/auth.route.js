import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { env } from '../loadEnv.js';

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

export default router;
