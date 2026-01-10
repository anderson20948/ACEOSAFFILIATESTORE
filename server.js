const express = require("express");
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const csrf = require("csurf");
const app = express();

const PORT = process.env.PORT || 3000;

const initializePassport = require("./passportConfig");

initializePassport(passport);

// Super Admin Configuration
const SUPER_ADMINS = ['tsumamngindodenis@gmail.com', 'malomoanderson@gmail.com'];
const ADMIN_HASH = '$2b$10$gRxJGNaRQT0wCa9LNTYmVe6aKFG8jBeEh2I/ZH0t8I/KUfPXKHHUK'; // Dennis123

function isSuperAdmin(email) {
  return SUPER_ADMINS.includes(email);
}

// Seed Super Admin if not exists
async function seedSuperAdmin() {
  try {
    const res = await pool.query("SELECT * FROM users WHERE email = $1", [SUPER_ADMINS[0]]);
    if (res.rows.length === 0) {
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        ['Dennis Admin', SUPER_ADMINS[0], ADMIN_HASH, 'admin']
      );
      console.log("Super Admin seeded.");
    }
  } catch (err) {
    console.error("Seeding failed:", err.message);
  }
}
seedSuperAdmin();

// User Action Logger Middleware
async function logAction(req, res, next) {
  const user = req.user ? req.user.email : 'anonymous';
  const method = req.method;
  const path = req.path;
  const timestamp = new Date().toISOString();

  // Log only meaningful write operations
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    try {
      await pool.query(
        "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
        [`${user} performed ${method} on ${path}`]
      );
    } catch (err) {
      console.error("Logging failed:", err);
    }
  }
  next();
}

// Super Admin Middleware
function checkSuperAdmin(req, res, next) {
  if (req.user && isSuperAdmin(req.user.email)) {
    return next();
  }
  // If API request, return JSON; otherwise redirect
  if (req.path.startsWith('/api')) {
    return res.status(403).json({ error: "Access denied. Super Admin privileges required." });
  }
  res.redirect("/users/login");
}

// Middleware
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(cookieParser());
const csrfProtection = csrf({ cookie: true });
// Apply CSRF protection to all POST requests by default, except where skipped
// For simplicity in this demo, we'll keep it global but pass the token.
app.use(csrfProtection);

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "views")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use("/fonts", express.static(path.join(__dirname, "fonts")));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use(express.static(path.join(__dirname, "users")));
app.use(express.json());
app.use(logAction);

// Pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/home.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/home", (req, res) => {
  res.redirect("/home.html");
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/login", (req, res) => {
  res.redirect("/login.html");
});

app.get("/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

app.get("/register", (req, res) => {
  res.redirect("/register.html");
});

app.get("/admin.html", checkSuperAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

app.get("/admin", (req, res) => {
  res.redirect("/admin.html");
});

app.get("/index", (req, res) => {
  res.render("index");
});

app.get("/users/register", checkAuthenticated, (req, res) => {
  res.render("register");
});

app.get("/users/login", checkAuthenticated, (req, res) => {
  // flash sets a messages variable. passport sets the error message
  res.render("login");
});

app.get("/users/dashboard", checkNotAuthenticated, (req, res) => {
  console.log(req.isAuthenticated());
  res.render("dashboard", { user: req.user.name });
});

app.get("/users/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    req.flash("success_msg", "You have logged out successfully");
    res.redirect("/users/login");
  });
});

app.post("/users/register", async (req, res) => {
  let { name, email, password, password2 } = req.body;

  let errors = [];

  console.log({
    name,
    email,
    password,
    password2
  });

  if (!name || !email || !password || !password2) {
    errors.push({ message: "Please enter all fields" });
  }

  if (password.length < 6) {
    errors.push({ message: "Password must be a least 6 characters long" });
  }

  if (password !== password2) {
    errors.push({ message: "Passwords do not match" });
  }

  if (errors.length > 0) {
    res.render("register", { errors, name, email, password, password2 });
  } else {
    hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);
    // Validation passed
    pool.query(
      `SELECT * FROM users
        WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          console.log(err);
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          return res.render("register", {
            message: "Email already registered"
          });
        } else {
          pool.query(
            `INSERT INTO users (name, email, password)
                VALUES ($1, $2, $3)
                RETURNING id, password`,
            [name, email, hashedPassword],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log(results.rows);
              req.flash("success_msg", "You are now registered. Please log in");
              res.redirect("/users/login");
            }
          );
        }
      }
    );
  }
});

app.post(
  "/users/login",
  passport.authenticate("local", {
    successRedirect: "/users/dashboard",
    failureRedirect: "/users/login",
    failureFlash: true
  })
);

// --- AJAX / API Endpoints for Dashboard ---

// JSON Auth Login
app.post("/api/auth/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: info.message || "Login failed" });

    req.logIn(user, (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // For simplicity in this demo, we use a mock token. 
      // In production, use JWT or proper session management.
      return res.json({
        token: "session-active-" + user.id,
        role: user.role || "affiliate",
        id: user.id,
        username: user.name
      });
    });
  })(req, res, next);
});

// JSON Auth Register
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Please provide name, email, and password" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  try {
    // Check if email already exists
    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const results = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [username, email, hashedPassword, "affiliate"]
    );

    // Also log this activity
    await pool.query(
      "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
      [`New user registered: ${username} (${email})`]
    );

    res.json({ message: "Registration successful", user: results.rows[0] });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ error: "A server error occurred during registration" });
  }
});

// Admin Stats
app.get("/api/admin/stats", checkSuperAdmin, async (req, res) => {
  try {
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    const revenue = await pool.query("SELECT SUM(amount) FROM payments");
    const pending = await pool.query("SELECT COUNT(*) FROM products WHERE status = 'pending'");

    res.json({
      totalUsers: userCount.rows[0].count,
      totalRevenue: revenue.rows[0].sum || 0,
      totalClicks: 1250, // Simulated real-time click tracking
      pendingApprovals: pending.rows[0].count,
      performanceMetrics: {
        topProduct: "Deluxe Coupon Pack",
        conversionRate: "4.2%"
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Activities
app.get("/api/admin/activities", checkSuperAdmin, async (req, res) => {
  try {
    const results = await pool.query("SELECT * FROM activities ORDER BY created_at DESC LIMIT 20");
    res.json(results.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pending Products
app.get("/api/admin/pending-products", checkSuperAdmin, async (req, res) => {
  try {
    const results = await pool.query("SELECT * FROM products WHERE status = 'pending'");
    res.json(results.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve Product
app.post("/api/admin/approve-product", checkSuperAdmin, async (req, res) => {
  const { productId, action } = req.body;
  const status = action === "approve" ? "approved" : "rejected";
  try {
    await pool.query("UPDATE products SET status = $1 WHERE id = $2", [status, productId]);
    res.json({ message: `Product ${status} successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Users List
app.get("/api/admin/users", async (req, res) => {
  try {
    const results = await pool.query("SELECT id, name as username, email, role, created_at FROM users");
    res.json(results.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payments List
app.get("/api/admin/payments", async (req, res) => {
  try {
    const results = await pool.query("SELECT * FROM payments ORDER BY created_at DESC");
    res.json(results.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contact Form Endpoint
app.post("/api/contact", async (req, res) => {
  const { name, email, subject, message, phone } = req.body;
  console.log("Contact Form Submission:", { name, email, subject, message, phone });

  try {
    // Log to activities for standard tracking
    await pool.query(
      "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
      [`Contact from ${name}: ${subject} (Follow-up: malomoanderson@gmail.com, tsumamngindodenis@gmail.com)`]
    );

    // Simulation of actual email sending to Super Admins
    console.log(`[EMAIL NOTIFICATION] To: malomoanderson@gmail.com, tsumamngindodenis@gmail.com`);
    console.log(`[CONTENT] Name: ${name}, Email: ${email}, Phone: ${phone}, Message: ${message}`);

    res.json({ success: true, message: "Thank you! Our team has been notified and will follow up with you shortly." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Forgot Password Flow
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const results = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (results.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }
    // Simulation: In reality, send a reset token via email
    console.log(`Password reset requested for: ${email}`);
    res.json({ success: true, message: "Recovery email sent successfully (Simulated)" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper for initial admin creation
app.get("/api/setup-admin", async (req, res) => {
  try {
    const email = "admin@bamburi.com";
    const pass = await bcrypt.hash("admin123", 10);
    await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET role = 'admin'",
      ["Super Admin", email, pass, "admin"]
    );
    res.send("Admin user created/updated: admin@bamburi.com / admin123");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/users/dashboard");
  }
  next();
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/users/login");
}
// CSRF Token endpoint for AJAX
app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Register Products Route
app.use("/api/products", require("./routes/products"));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});