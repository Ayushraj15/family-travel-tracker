import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";


dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect();


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


let currentUserId = 1;
let users = [];

async function checkVisited() {
  const result = await db.query(
    `SELECT country_code 
     FROM visited_countries 
     WHERE user_id = $1`,
    [currentUserId]
  );
  return result.rows.map((row) => row.country_code);
}

async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  return users.find((user) => user.id == currentUserId);
}



app.get("/", async (req, res) => {
  try {
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();

    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser?.color || "gray", // ✅ safe fallback
    });
  } catch (err) {
    console.error(err);
    res.send("Error loading page.");
  }
});


app.post("/add", async (req, res) => {
  const input = req.body["country"];
  try {
    const result = await db.query(
      `SELECT country_code 
       FROM countries 
       WHERE LOWER(country_name) LIKE '%' || $1 || '%'`,
      [input.toLowerCase()]
    );

    const countryCode = result.rows[0].country_code;

    await db.query(
      `INSERT INTO visited_countries (country_code, user_id) 
       VALUES ($1, $2)`,
      [countryCode, currentUserId]
    );
  } catch (err) {
    console.error(err);
  }
  res.redirect("/");
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const { name, color } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO users (name, color) 
       VALUES ($1, $2) RETURNING *`,
      [name, color]
    );
    currentUserId = result.rows[0].id;
  } catch (err) {
    console.error(err);
  }
  res.redirect("/");
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

