const express = require('express');
const path = require('path');
const sqlite = require('sqlite3');
const { open } = require('sqlite');
const session = require('express-session');

const app = express();

app.use(express.urlencoded({ extended: true }));

const dbPromise = open({
    filename: path.join(__dirname, 'database.db'),
    driver: sqlite.Database
});

async function setupDatabase() {
    const db = await dbPromise;
    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    `);

    // Create admin user if not exists
    const adminUser = await db.get("SELECT * FROM users WHERE fullname = 'admin'");
    if (!adminUser) {
        await db.run("INSERT INTO users (fullname, password, is_admin) VALUES (?, ?, ?)", ['admin', '1234', 1]);
        console.log("Admin user created.");
    }
}

setupDatabase().catch(err => console.error(err));

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.resolve('public/index.html')));
app.get('/register', (req, res) => res.sendFile(path.resolve('public/register.html')));
app.get('/login', (req, res) => res.sendFile(path.resolve('public/login.html')));
app.get('/aboutus', (req, res) => res.sendFile(path.resolve('public/aboutus.html')));

app.post('/register', async (req, res) => {
    const { fullname, password } = req.body;
    try {
        const db = await dbPromise;
        await db.run(`INSERT INTO users (fullname, password) VALUES (?, ?)`, [fullname, password]);
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error registering user');
    }
});

app.post('/login', async (req, res) => {
    try {
        const db = await dbPromise;
        const { fullname, password } = req.body;
        const user = await db.get(`SELECT * FROM users WHERE fullname=? AND password=?`, [fullname, password]);

        if (user) {
            req.session.user = { id: user.id, fullname: user.fullname, is_admin: user.is_admin };
            res.redirect('/loggedin');
        } else {
            res.status(401).send('User does not exist');
        }
    } catch (error) {
        console.log(error);
        res.status(500).sendFile(path.resolve('public/register.html'));
    }
});

app.post('/createpost', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('You must be logged in to post.');
    }

    const { posting } = req.body;
    if (!posting) {
        return res.status(400).send('Please enter a post value');
    }

    const db = await dbPromise;
    await db.run(`INSERT INTO posts (user_id, post) VALUES (?, ?)`, [req.session.user.id, posting]);
    res.redirect('/loggedin');
});

app.post('/deletepost/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('You must be logged in to delete a post.');
    }

    const db = await dbPromise;
    const post = await db.get(`SELECT * FROM posts WHERE id = ?`, [req.params.id]);

    if (!post) {
        return res.status(404).send('Post not found.');
    }

    if (!req.session.user.is_admin && post.user_id !== req.session.user.id) {
        return res.status(403).send('You are not allowed to delete this post.');
    }

    await db.run(`DELETE FROM posts WHERE id = ?`, [req.params.id]);
    res.redirect('/loggedin');
});

app.get('/editpost/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('You must be logged in to edit a post.');
    }

    const db = await dbPromise;
    const post = await db.get(`SELECT * FROM posts WHERE id = ?`, [req.params.id]);

    if (!post) {
        return res.status(404).send('Post not found.');
    }

    if (!req.session.user.is_admin && post.user_id !== req.session.user.id) {
        return res.status(403).send('You are not allowed to edit this post.');
    }

    let html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Edit Post</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <h2>Edit Your Post</h2>
        <form action="/editpost/${post.id}" method="POST">
            <textarea name="newPost" rows="4" cols="50">${post.post}</textarea>
            <br>
            <button type="submit">Save Changes</button>
        </form>
      </body>
    </html>`;

    res.send(html);
});

app.post('/editpost/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('You must be logged in to edit a post.');
    }

    const db = await dbPromise;
    const { newPost } = req.body;
    const post = await db.get(`SELECT * FROM posts WHERE id = ?`, [req.params.id]);

    if (!post) {
        return res.status(404).send('Post not found.');
    }

    if (!req.session.user.is_admin && post.user_id !== req.session.user.id) {
        return res.status(403).send('You are not allowed to edit this post.');
    }

    await db.run(`UPDATE posts SET post = ? WHERE id = ?`, [newPost, req.params.id]);
    res.redirect('/loggedin');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.listen('3001', () => {
    console.log('Server is running on port 3001');
});