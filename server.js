const express = require('express');
const path = require('path');
const sqlite = require('sqlite3');
const { open } = require('sqlite');
const app = express();

app.use(express.urlencoded({ extended: true }));

const dbPromise = open({
    filename: path.join(__dirname, 'database.db'),
    driver: sqlite.Database
});

CREATEuserTabel().catch(err => console.error(err));
CREATEposts().catch(err => console.error(err));
app.use(async (req, res, next) => {
    const db = await dbPromise;
    req.db = db;
    next();
});

async function CREATEuserTabel() {
    const db = await dbPromise;
    //await db.exec(`DROP TABLE IF EXISTS users`);
    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);
}
async function CREATEposts() {
    const db = await dbPromise;
    await db.exec(`DROP TABLE IF EXISTS posts`);
    await db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      post TEXT NOT NULL  
    )
  `);
}

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.resolve('public/index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.resolve('public/register.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.resolve('public/login.html'));
});

app.post('/register', async (req, res) => {
    const { fullname, password } = req.body;
    try {
        const db = await req.db;
        await db.run(`INSERT INTO users (fullname, password) VALUES (?, ?)`, [fullname, password]);
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error registering user');
    }
});

app.post('/login', async (req, res) => {
    try {
        const db = await req.db;
        const { fullname, password } = req.body;
        const user = await db.get(`SELECT * FROM users WHERE fullname=? AND password=?`, [fullname, password]);
        if (user) {
            res.redirect('/loggedin');
        } else {
            res.status(401).send('user dont exsist')
        }
    } catch (error) {
        console.log(error);
        res.status(500).sendFile(path.resolve('public/register.html'));
    }
});


app.post('/createpost', async (req, res) => {
    const { posting } = req.body;
    const db = await req.db;
    if (!posting) {
        return res.status(400).send('Please enter a post value');
    }
    await db.run(`INSERT INTO posts (post) VALUES (?)`, [posting]);


    res.redirect('/loggedin');
})
app.get('/loggedin', async (req, res) => {
    const db = await req.db;
    const posts = await db.all('SELECT * FROM posts');
    let html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Logged In</title>
        <link rel="stylesheet" href="style.css">
      </head>
      <body>
        <button onclick="window.location.href='/index.html'">log out</button>     
        <button onclick="window.location.href='/createpost.html'">post!</button>
        <h1>create peace by sharing idea</h1>
        <h3>All Posts</h3>
        <div class="posts-container">
  `;

    posts.forEach(row => {
        html += `<p class="post">${row.post}</p>`;
    });

    html += `
        </div>
      </body>
    </html>
  `;

    res.send(html);
});



app.listen('3001', () => {
    console.log('server is running on port 3001');
});
