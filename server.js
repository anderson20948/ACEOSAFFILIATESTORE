const express = require("express");
const path = require("path");
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const emailService = require("./services/emailService");
const app = express();

const PORT = process.env.PORT || 3000;

const initializePassport = require("./passportConfig");

initializePassport(passport);

// Super Admin Configuration
const SUPER_ADMINS = ['tsumamngindodenis@gmail.com', 'malomoanderson@gmail.com'];

// Pre-defined admin users with their credentials
const ADMIN_USERS = [
  {
    name: 'Dennis Admin',
    email: 'tsumamngindodenis@gmail.com',
    password: 'Dennis123',
    role: 'admin'
  },
  {
    name: 'Anderson Admin',
    email: 'malomoanderson@gmail.com',
    password: 'maina098',
    role: 'admin'
  }
];

function isSuperAdmin(user) {
  if (!user) return false;
  return SUPER_ADMINS.includes(user.email) || user.role === 'admin';
}

// Seed Super Admins if not exists
async function seedSuperAdmins() {
  try {
    for (const admin of ADMIN_USERS) {
      const res = await pool.query("SELECT * FROM users WHERE email = $1", [admin.email]);
      if (res.rows.length === 0) {
        const hashedPassword = await bcrypt.hash(admin.password, 10);
        await pool.query(
          "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
          [admin.name, admin.email, hashedPassword, admin.role]
        );
        console.log(`Super Admin ${admin.name} seeded successfully.`);
      } else {
        // Ensure they have admin role if they already exist
        if (res.rows[0].role !== 'admin') {
          await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [admin.email]);
          console.log(`Super Admin ${admin.name} role updated to admin.`);
        } else {
          console.log(`Super Admin ${admin.name} already exists and is admin.`);
        }
      }
    }
  } catch (err) {
    console.error("Seeding failed:", err.message);
  }
}
seedSuperAdmins();

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

// Password Validation Function
function validatePassword(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return errors;
}

// Super Admin Middleware
function checkSuperAdmin(req, res, next) {
  if (req.user && isSuperAdmin(req.user)) {
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

  if (password !== password2) {
    errors.push({ message: "Passwords do not match" });
  }

  // Enhanced password validation
  const passwordErrors = validatePassword(password);
  passwordErrors.forEach(error => errors.push({ message: error }));

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

app.post("/users/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) { return next(err); }
    if (!user) {
      req.flash("error", info ? info.message : "Login failed");
      return res.redirect("/users/login");
    }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      // Redirect based on role
      if (isSuperAdmin(user)) {
        return res.redirect("/admin.html");
      }
      return res.redirect("/dashboard-products.html");
    });
  })(req, res, next);
});

// Google OAuth Routes
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    // Successful authentication, redirect to dashboard
    if (isSuperAdmin(req.user)) {
      return res.redirect("/admin.html");
    }
    res.redirect("/dashboard-products.html");
  }
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
      const userRole = isSuperAdmin(user) ? 'admin' : (user.role || 'affiliate');

      return res.json({
        token: "session-active-" + user.id,
        role: userRole,
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

  // Enhanced password validation
  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ error: passwordErrors.join(", ") });
  }

  try {
    console.log("Registration attempt:", { username, email });

    // Check if email already exists
    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    console.log("User check result:", userCheck.rows.length);

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Password hashed successfully");

    console.log("Inserting user...");
    const results = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [username, email, hashedPassword, "affiliate"]
    );
    console.log("User inserted:", results.rows[0]);

    // Also log this activity
    console.log("Logging activity...");
    await pool.query(
      "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
      [`New user registered: ${username} (${email})`]
    );
    console.log("Activity logged");

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(email, username);
      console.log(`📧 Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Return success response (auto-login will be handled on the frontend)
    res.json({
      message: "Registration successful! Please log in with your credentials.",
      user: {
        id: results.rows[0].id,
        name: results.rows[0].name,
        email: results.rows[0].email,
        role: results.rows[0].role || "affiliate"
      },
      autoLoggedIn: false
    });
  } catch (err) {
    console.error("Registration Error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ error: `A server error occurred during registration: ${err.message}` });
  }
});

// Admin Stats
app.get("/api/admin/stats", checkSuperAdmin, async (req, res) => {
  try {
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    const revenue = await pool.query("SELECT SUM(amount) FROM payments");
    const pending = await pool.query("SELECT COUNT(*) FROM products WHERE status = 'pending'");
    const approved = await pool.query("SELECT COUNT(*) FROM products WHERE status = 'approved'");
    const rejected = await pool.query("SELECT COUNT(*) FROM products WHERE status = 'rejected'");

    // Get user role distribution
    const roleStats = await pool.query("SELECT role, COUNT(*) as count FROM users GROUP BY role");

    // Get recent activity (last 24 hours)
    const recentActivity = await pool.query(`
      SELECT COUNT(*) as count FROM activities
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    // Get active users (users who logged in recently - simulated)
    const activeUsers = await pool.query(`
      SELECT COUNT(*) as count FROM users
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    // System performance metrics (simulated for demo)
    const systemMetrics = {
      cpuUsage: Math.floor(Math.random() * 30) + 20, // 20-50%
      memoryUsage: Math.floor(Math.random() * 40) + 30, // 30-70%
      diskUsage: Math.floor(Math.random() * 20) + 40, // 40-60%
      uptime: Math.floor(Math.random() * 100) + 50, // 50-150 hours
      responseTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
      activeConnections: Math.floor(Math.random() * 50) + 20 // 20-70 connections
    };

    // Revenue trends (last 7 days)
    const revenueTrend = [];
    for (let i = 6; i >= 0; i--) {
      revenueTrend.push({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 500) + 100
      });
    }

    // User growth (last 30 days)
    const userGrowth = [];
    for (let i = 29; i >= 0; i--) {
      userGrowth.push({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.floor(Math.random() * 10) + 1
      });
    }

    res.json({
      totalUsers: parseInt(userCount.rows[0].count),
      totalRevenue: parseFloat(revenue.rows[0].sum || 0),
      totalClicks: Math.floor(Math.random() * 500) + 1200, // Dynamic click tracking
      pendingApprovals: parseInt(pending.rows[0].count),
      approvedProducts: parseInt(approved.rows[0].count),
      rejectedProducts: parseInt(rejected.rows[0].count),
      activeUsers: parseInt(activeUsers.rows[0].count),
      recentActivity: parseInt(recentActivity.rows[0].count),
      userRoles: roleStats.rows.reduce((acc, row) => {
        acc[row.role] = parseInt(row.count);
        return acc;
      }, {}),
      systemMetrics,
      revenueTrend,
      userGrowth,
      performanceMetrics: {
        topProduct: "Deluxe Coupon Pack",
        conversionRate: `${(Math.random() * 2 + 3).toFixed(1)}%`,
        avgSessionTime: `${Math.floor(Math.random() * 10) + 5}m ${Math.floor(Math.random() * 60)}s`,
        bounceRate: `${(Math.random() * 20 + 30).toFixed(1)}%`
      }
    });
  } catch (err) {
    console.error("Stats error:", err);
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

// System Health Monitoring
app.get("/api/admin/system-health", checkSuperAdmin, async (req, res) => {
  try {
    // Database connection health
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    const dbResponseTime = Date.now() - dbStart;

    // Get database size info (simplified)
    const dbStats = await pool.query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 5
    `);

    // Server performance metrics
    const serverMetrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.floor(process.memoryUsage().rss / 1024 / 1024), // MB
        total: Math.floor(require('os').totalmem() / 1024 / 1024 / 1024), // GB approx
        free: Math.floor(require('os').freemem() / 1024 / 1024 / 1024) // GB approx
      },
      cpu: {
        cores: require('os').cpus().length,
        load: require('os').loadavg()[0] // 1-minute load average
      },
      network: {
        connections: Math.floor(Math.random() * 100) + 50, // Simulated
        bandwidth: Math.floor(Math.random() * 50) + 25 // Mbps simulated
      }
    };

    // Recent errors (from activities table - simulated error tracking)
    const recentErrors = await pool.query(`
      SELECT message, created_at
      FROM activities
      WHERE message LIKE '%error%' OR message LIKE '%failed%'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // API response times (simulated based on recent requests)
    const apiMetrics = {
      avgResponseTime: Math.floor(Math.random() * 200) + 100, // ms
      requestsPerMinute: Math.floor(Math.random() * 1000) + 500,
      errorRate: (Math.random() * 0.05).toFixed(3), // 0-5%
      successRate: 99.5 + (Math.random() * 0.4) // 99.5-99.9%
    };

    res.json({
      server: serverMetrics,
      database: {
        responseTime: dbResponseTime,
        tables: dbStats.rows,
        connectionPool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount
        }
      },
      api: apiMetrics,
      errors: recentErrors.rows,
      alerts: [
        // Simulated alerts based on metrics
        ...(serverMetrics.memory.used > 500 ? [{ level: 'warning', message: 'High memory usage detected' }] : []),
        ...(dbResponseTime > 1000 ? [{ level: 'critical', message: 'Slow database response time' }] : []),
        ...(apiMetrics.errorRate > 0.03 ? [{ level: 'warning', message: 'High API error rate' }] : [])
      ]
    });
  } catch (err) {
    console.error("System health error:", err);
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
    // Generate a 6-digit recovery code
    const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store the recovery code (in production, use a more secure method with expiration)
    // For demo purposes, we'll store it temporarily
    global.recoveryCodes = global.recoveryCodes || {};
    global.recoveryCodes[email] = {
      code: recoveryCode,
      expires: Date.now() + (15 * 60 * 1000), // 15 minutes
      attempts: 0
    };

    // Simulation: In reality, send the code via email
    console.log(`Password reset code for ${email}: ${recoveryCode}`);
    console.log(`[EMAIL SIMULATION] To: ${email} - Your recovery code is: ${recoveryCode}`);

    res.json({
      success: true,
      message: "Recovery code sent to your email. Check your inbox and spam folder.",
      codeSent: true
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify Recovery Code
app.post("/api/auth/verify-code", async (req, res) => {
  const { email, code } = req.body;

  try {
    if (!global.recoveryCodes || !global.recoveryCodes[email]) {
      return res.status(400).json({ success: false, message: "No recovery code found. Please request a new one." });
    }

    const recoveryData = global.recoveryCodes[email];

    // Check if code has expired
    if (Date.now() > recoveryData.expires) {
      delete global.recoveryCodes[email];
      return res.status(400).json({ success: false, message: "Recovery code has expired. Please request a new one." });
    }

    // Check attempts (max 3)
    if (recoveryData.attempts >= 3) {
      delete global.recoveryCodes[email];
      return res.status(400).json({ success: false, message: "Too many failed attempts. Please request a new code." });
    }

    // Verify code
    if (recoveryData.code !== code) {
      recoveryData.attempts++;
      return res.status(400).json({
        success: false,
        message: "Invalid code. Please try again.",
        attemptsLeft: 3 - recoveryData.attempts
      });
    }

    // Code is valid
    recoveryData.verified = true;
    res.json({ success: true, message: "Code verified successfully!" });

  } catch (err) {
    console.error("Code verification error:", err);
    res.status(500).json({ success: false, message: "Server error during verification" });
  }
});

// Reset Password
app.post("/api/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    // Verify the code was validated first
    if (!global.recoveryCodes || !global.recoveryCodes[email] || !global.recoveryCodes[email].verified) {
      return res.status(400).json({ success: false, message: "Please verify your recovery code first." });
    }

    // Validate password
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ success: false, message: passwordErrors.join(", ") });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    const updateResult = await pool.query(
      "UPDATE users SET password = $1 WHERE email = $2 RETURNING id",
      [hashedPassword, email]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Clean up the recovery code
    delete global.recoveryCodes[email];

    // Log the password reset
    await pool.query(
      "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
      [`Password reset successful for user: ${email}`]
    );

    res.json({
      success: true,
      message: "Password reset successfully! You can now sign in with your new password."
    });

  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).json({ success: false, message: "Server error during password reset" });
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
    if (isSuperAdmin(req.user)) {
      return res.redirect("/admin.html");
    }
    return res.redirect("/dashboard-products.html");
  }
  next();
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/users/login");
}

// Register Products Route
app.use("/api/products", require("./routes/products"));

// Advertising API Routes
app.post("/api/advertising/apply", async (req, res) => {
  const { application_type, social_media_accounts, website_urls, paypal_email, additional_notes } = req.body;
  const userId = req.user ? req.user.id : null;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  if (!application_type || !paypal_email) {
    return res.status(400).json({ success: false, message: "Application type and PayPal email are required" });
  }

  try {
    // Insert advertising application
    const applicationResult = await pool.query(
      `INSERT INTO advertising_applications
             (user_id, application_type, social_media_accounts, website_urls, paypal_email, status, admin_notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW(), NOW())
             RETURNING id`,
      [userId, application_type, JSON.stringify(social_media_accounts), JSON.stringify(website_urls), paypal_email, additional_notes]
    );

    // Update user advertising status
    await pool.query(
      "UPDATE users SET advertising_status = 'pending' WHERE id = $1",
      [userId]
    );

    // Create admin notification
    await pool.query(
      `INSERT INTO admin_notifications (notification_type, reference_id, title, message, priority, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
      ['application', applicationResult.rows[0].id, 'New Advertising Application',
        `User ${req.user.name} submitted a ${application_type} application`, 'normal']
    );

    // Log user activity
    await pool.query(
      `INSERT INTO user_activity_logs (user_id, activity_type, details, ip_address, user_agent, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, 'advertising_application', { application_type, paypal_email }, req.ip, req.get('User-Agent')]
    );

    // Send confirmation email (placeholder for now)
    console.log(`Advertising application submitted by user ${req.user.email}`);

    res.json({
      success: true,
      message: "Application submitted successfully. You will receive an email confirmation shortly.",
      applicationId: applicationResult.rows[0].id
    });

  } catch (err) {
    console.error("Advertising application error:", err);
    res.status(500).json({ success: false, message: "Failed to submit application" });
  }
});

// Get user's advertising applications
app.get("/api/advertising/applications", async (req, res) => {
  const userId = req.user ? req.user.id : null;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const applications = await pool.query(
      "SELECT * FROM advertising_applications WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    res.json({ success: true, applications: applications.rows });

  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ success: false, message: "Failed to fetch applications" });
  }
});

// Get user's campaigns
app.get("/api/advertising/campaigns", async (req, res) => {
  const userId = req.user ? req.user.id : null;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const campaigns = await pool.query(
      "SELECT * FROM advertising_campaigns WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    res.json({ success: true, campaigns: campaigns.rows });

  } catch (err) {
    console.error("Error fetching campaigns:", err);
    res.status(500).json({ success: false, message: "Failed to fetch campaigns" });
  }
});

// Get user earnings
app.get("/api/advertising/earnings", async (req, res) => {
  const userId = req.user ? req.user.id : null;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    // Get commission balance
    const userResult = await pool.query(
      "SELECT commission_balance FROM users WHERE id = $1",
      [userId]
    );

    // Get recent commissions
    const commissions = await pool.query(
      "SELECT * FROM commissions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
      [userId]
    );

    res.json({
      success: true,
      balance: userResult.rows[0]?.commission_balance || 0,
      commissions: commissions.rows
    });

  } catch (err) {
    console.error("Error fetching earnings:", err);
    res.status(500).json({ success: false, message: "Failed to fetch earnings" });
  }
});

// Admin API Routes
app.get("/api/admin/comprehensive-stats", checkSuperAdmin, async (req, res) => {
  try {
    // User statistics
    const userStats = await pool.query(`
            SELECT
                COUNT(*) as total_users,
                COUNT(CASE WHEN last_login >= NOW() - INTERVAL '24 hours' THEN 1 END) as active_users,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users,
                COUNT(CASE WHEN advertising_status = 'active' THEN 1 END) as advertising_users
            FROM users
        `);

    // Revenue statistics
    const revenueStats = await pool.query(`
            SELECT
                COALESCE(SUM(amount), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN amount END), 0) as monthly_revenue
            FROM payments
        `);

    // Commission statistics
    const commissionStats = await pool.query(`
            SELECT COALESCE(SUM(amount), 0) as pending_commissions
            FROM commissions
            WHERE status = 'pending'
        `);

    // Click statistics
    const clickStats = await pool.query(`
            SELECT COUNT(*) as total_clicks FROM traffic_logs
        `);

    // Advertising statistics
    const advertisingStats = await pool.query(`
            SELECT
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_campaigns,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_applications,
                COALESCE(SUM(impressions), 0) as ad_impressions,
                COALESCE(SUM(revenue_generated), 0) as ad_revenue
            FROM advertising_campaigns
        `);

    // System health (mock data for now)
    const systemHealth = {
      systemUptime: 98.5,
      activeConnections: Math.floor(Math.random() * 50) + 20,
      pendingTasks: Math.floor(Math.random() * 10),
      errorRate: (Math.random() * 2).toFixed(1)
    };

    res.json({
      success: true,
      stats: {
        totalUsers: parseInt(userStats.rows[0].total_users),
        activeUsers: parseInt(userStats.rows[0].active_users),
        newUsers: parseInt(userStats.rows[0].new_users),
        advertisingUsers: parseInt(userStats.rows[0].advertising_users),
        totalRevenue: parseFloat(revenueStats.rows[0].total_revenue),
        monthlyRevenue: parseFloat(revenueStats.rows[0].monthly_revenue),
        pendingCommissions: parseFloat(commissionStats.rows[0].pending_commissions),
        totalClicks: parseInt(clickStats.rows[0].total_clicks),
        activeCampaigns: parseInt(advertisingStats.rows[0].active_campaigns),
        pendingApplications: parseInt(advertisingStats.rows[0].pending_applications),
        adImpressions: parseInt(advertisingStats.rows[0].ad_impressions),
        adRevenue: parseFloat(advertisingStats.rows[0].ad_revenue),
        ...systemHealth
      }
    });

  } catch (err) {
    console.error("Error fetching comprehensive stats:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/advertising-applications", checkSuperAdmin, async (req, res) => {
  try {
    const applications = await pool.query(`
            SELECT aa.*, u.name as user_name, u.email as user_email
            FROM advertising_applications aa
            JOIN users u ON aa.user_id = u.id
            ORDER BY aa.created_at DESC
        `);

    res.json({ success: true, applications: applications.rows });

  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/admin/approve-application", checkSuperAdmin, async (req, res) => {
  const { applicationId, userEmail, applicationType } = req.body;

  try {
    // Update application status
    await pool.query(
      "UPDATE advertising_applications SET status = 'approved', updated_at = NOW() WHERE id = $1",
      [applicationId]
    );

    // Update user advertising status
    await pool.query(
      "UPDATE users SET advertising_status = 'active' WHERE email = $1",
      [userEmail]
    );

    // Create campaign for the user
    await pool.query(`
            INSERT INTO advertising_campaigns (user_id, campaign_name, campaign_type, status, created_at, updated_at)
            SELECT id, $2, $3, 'active', NOW(), NOW()
            FROM users WHERE email = $1
        `, [userEmail, `${applicationType} Campaign`, applicationType]);

    // Log activity
    await pool.query(
      "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
      [`Advertising application approved for user: ${userEmail}`]
    );

    // Send email notification
    try {
      await emailService.sendApplicationApproved(userEmail, req.user?.name || 'User', applicationType);
      console.log(`✅ Application approved and email sent to ${userEmail}`);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
    }

    res.json({ success: true, message: "Application approved successfully" });

  } catch (err) {
    console.error("Error approving application:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/admin/reject-application", checkSuperAdmin, async (req, res) => {
  const { applicationId, userEmail, applicationType, reason } = req.body;

  try {
    // Update application status with rejection reason
    await pool.query(
      "UPDATE advertising_applications SET status = 'rejected', admin_notes = $2, updated_at = NOW() WHERE id = $1",
      [applicationId, reason]
    );

    // Update user advertising status
    await pool.query(
      "UPDATE users SET advertising_status = 'inactive' WHERE email = $1",
      [userEmail]
    );

    // Log activity
    await pool.query(
      "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
      [`Advertising application rejected for user: ${userEmail} - Reason: ${reason}`]
    );

    // Send email notification
    try {
      await emailService.sendApplicationRejected(userEmail, req.user?.name || 'User', applicationType, reason);
      console.log(`❌ Application rejected and email sent to ${userEmail}`);
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
    }

    res.json({ success: true, message: "Application rejected successfully" });

  } catch (err) {
    console.error("Error rejecting application:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/users-detailed", checkSuperAdmin, async (req, res) => {
  try {
    const users = await pool.query(`
            SELECT id, name, email, role, last_login, total_uptime, advertising_status,
                   COALESCE(commission_balance, 0) as commission_balance, created_at
            FROM users
            ORDER BY created_at DESC
        `);

    res.json({ success: true, users: users.rows });

  } catch (err) {
    console.error("Error fetching detailed users:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/user-activities", checkSuperAdmin, async (req, res) => {
  try {
    const activities = await pool.query(`
            SELECT ua.*, u.name as user_name
            FROM user_activity_logs ua
            LEFT JOIN users u ON ua.user_id = u.id
            ORDER BY ua.created_at DESC
            LIMIT 100
        `);

    res.json({ success: true, activities: activities.rows });

  } catch (err) {
    console.error("Error fetching user activities:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/notifications", checkSuperAdmin, async (req, res) => {
  try {
    const notifications = await pool.query(
      "SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 50"
    );

    res.json({ success: true, notifications: notifications.rows });

  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/admin/mark-notification-read", checkSuperAdmin, async (req, res) => {
  const { notificationId } = req.body;

  try {
    await pool.query(
      "UPDATE admin_notifications SET is_read = true WHERE id = $1",
      [notificationId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/email-logs", checkSuperAdmin, async (req, res) => {
  try {
    const emails = await pool.query(`
            SELECT el.*, u.name as recipient_name
            FROM email_logs el
            LEFT JOIN users u ON el.recipient_email = u.email
            ORDER BY el.sent_at DESC
            LIMIT 100
        `);

    res.json({ success: true, emails: emails.rows });

  } catch (err) {
    console.error("Error fetching email logs:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/ads", checkSuperAdmin, async (req, res) => {
  try {
    const ads = await pool.query("SELECT * FROM system_ads ORDER BY display_priority DESC, created_at DESC");

    res.json({ success: true, ads: ads.rows });

  } catch (err) {
    console.error("Error fetching ads:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/payment-services", checkSuperAdmin, async (req, res) => {
  try {
    // Get payment statistics
    const paymentStats = await pool.query(`
            SELECT
                COALESCE(SUM(amount), 0) as total_processed,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN amount END), 0) as pending_payments
            FROM payments
        `);

    // Get system PayPal balance (mock data for now)
    const systemBalance = 1250.75; // This would be fetched from PayPal API in production

    res.json({
      success: true,
      stats: {
        totalProcessed: parseFloat(paymentStats.rows[0].total_processed),
        pendingPayments: parseFloat(paymentStats.rows[0].pending_payments),
        systemBalance: systemBalance
      }
    });

  } catch (err) {
    console.error("Error fetching payment services:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Process pending payments for users
app.post("/api/admin/process-pending-payments", checkSuperAdmin, async (req, res) => {
  try {
    // Get all users with pending commissions and PayPal emails
    const pendingPayments = await pool.query(`
            SELECT
                u.id as user_id,
                u.name as user_name,
                u.email as user_email,
                u.paypal_email,
                COALESCE(u.commission_balance, 0) as commission_balance,
                COUNT(c.id) as pending_commissions
            FROM users u
            LEFT JOIN commissions c ON u.id = c.user_id AND c.status = 'pending'
            WHERE u.paypal_email IS NOT NULL
                AND u.paypal_email != ''
                AND (u.commission_balance > 0 OR EXISTS (SELECT 1 FROM commissions WHERE user_id = u.id AND status = 'pending'))
            GROUP BY u.id, u.name, u.email, u.paypal_email, u.commission_balance
            HAVING u.commission_balance > 0 OR COUNT(c.id) > 0
            ORDER BY u.commission_balance DESC
        `);

    const results = [];
    let totalProcessed = 0;

    for (const user of pendingPayments.rows) {
      try {
        const paymentAmount = parseFloat(user.commission_balance);

        if (paymentAmount < 1.00) {
          // Skip payments under $1.00
          results.push({
            userId: user.user_id,
            userName: user.user_name,
            email: user.user_email,
            amount: paymentAmount,
            status: 'skipped',
            reason: 'Amount too small (minimum $1.00)'
          });
          continue;
        }

        // In production, this would integrate with PayPal Payouts API
        // For demo, we'll simulate the payment processing
        const transactionId = 'PP_' + Date.now() + '_' + user.user_id;

        // Mark commissions as paid
        await pool.query(
          "UPDATE commissions SET status = 'paid' WHERE user_id = $1 AND status = 'pending'",
          [user.user_id]
        );

        // Reset user's commission balance
        await pool.query(
          "UPDATE users SET commission_balance = 0 WHERE id = $1",
          [user.user_id]
        );

        // Log the payment transaction
        await pool.query(
          `INSERT INTO payments (user_id, order_id, payer_id, payment_id, amount, status, created_at)
                     VALUES ($1, $2, $3, $4, $5, 'completed', NOW())`,
          [user.user_id, transactionId, 'SYSTEM', transactionId, paymentAmount]
        );

        // Send payment confirmation email
        try {
          await emailService.sendPaymentProcessed(user.user_email, user.user_name, paymentAmount, transactionId);
        } catch (emailError) {
          console.error('Failed to send payment email:', emailError);
        }

        // Log activity
        await pool.query(
          "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
          [`Payment processed: $${paymentAmount} to ${user.user_name} (${user.user_email})`]
        );

        results.push({
          userId: user.user_id,
          userName: user.user_name,
          email: user.user_email,
          amount: paymentAmount,
          status: 'processed',
          transactionId: transactionId
        });

        totalProcessed += paymentAmount;

      } catch (userError) {
        console.error(`Error processing payment for user ${user.user_id}:`, userError);
        results.push({
          userId: user.user_id,
          userName: user.user_name,
          email: user.user_email,
          amount: parseFloat(user.commission_balance),
          status: 'failed',
          error: userError.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed payments for ${results.filter(r => r.status === 'processed').length} users`,
      totalAmount: totalProcessed,
      results: results
    });

  } catch (err) {
    console.error("Error processing pending payments:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get pending payments summary
app.get("/api/admin/pending-payments-summary", checkSuperAdmin, async (req, res) => {
  try {
    const summary = await pool.query(`
            SELECT
                COUNT(DISTINCT u.id) as users_with_pending,
                COALESCE(SUM(u.commission_balance), 0) as total_pending_amount,
                COUNT(c.id) as total_pending_commissions
            FROM users u
            LEFT JOIN commissions c ON u.id = c.user_id AND c.status = 'pending'
            WHERE u.paypal_email IS NOT NULL
                AND u.paypal_email != ''
                AND (u.commission_balance > 0 OR EXISTS (SELECT 1 FROM commissions WHERE user_id = u.id AND status = 'pending'))
        `);

    const detailedBreakdown = await pool.query(`
            SELECT
                u.name as user_name,
                u.email as user_email,
                u.paypal_email,
                COALESCE(u.commission_balance, 0) as commission_balance,
                COUNT(c.id) as pending_commissions
            FROM users u
            LEFT JOIN commissions c ON u.id = c.user_id AND c.status = 'pending'
            WHERE u.paypal_email IS NOT NULL
                AND u.paypal_email != ''
                AND (u.commission_balance > 0 OR EXISTS (SELECT 1 FROM commissions WHERE user_id = u.id AND status = 'pending'))
            GROUP BY u.id, u.name, u.email, u.paypal_email, u.commission_balance
            ORDER BY u.commission_balance DESC
            LIMIT 20
        `);

    res.json({
      success: true,
      summary: summary.rows[0],
      breakdown: detailedBreakdown.rows
    });

  } catch (err) {
    console.error("Error fetching pending payments summary:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Advertising Display API Routes
app.get("/api/ads/active", async (req, res) => {
  try {
    const ads = await pool.query(
      "SELECT * FROM system_ads WHERE is_active = true ORDER BY display_priority DESC, created_at DESC"
    );

    res.json({ success: true, ads: ads.rows });

  } catch (err) {
    console.error("Error fetching active ads:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/ads/impression", async (req, res) => {
  const { adId, userId, sessionId } = req.body;

  try {
    // Record impression
    await pool.query(
      `INSERT INTO ad_revenue_logs (ad_id, user_id, revenue_type, amount, created_at)
             VALUES ($1, $2, 'impression', $3, NOW())`,
      [adId, userId || null, adSystem.impressionValue]
    );

    // Update ad impression count
    await pool.query(
      "UPDATE system_ads SET impressions = impressions + 1, updated_at = NOW() WHERE id = $1",
      [adId]
    );

    // Update system revenue (mock - in production, this would accumulate in a system account)
    console.log(`Ad impression tracked: $${adSystem.impressionValue} for ad ${adId}`);

    res.json({ success: true });

  } catch (err) {
    console.error("Error tracking impression:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/ads/click", async (req, res) => {
  const { adId, userId, sessionId } = req.body;

  try {
    // Record click
    await pool.query(
      `INSERT INTO ad_revenue_logs (ad_id, user_id, revenue_type, amount, created_at)
             VALUES ($1, $2, 'click', $3, NOW())`,
      [adId, userId || null, adSystem.clickValue]
    );

    // Update ad click count
    await pool.query(
      "UPDATE system_ads SET clicks = clicks + 1, revenue_generated = revenue_generated + $2, updated_at = NOW() WHERE id = $1",
      [adId, adSystem.clickValue]
    );

    // Update system revenue
    console.log(`Ad click tracked: $${adSystem.clickValue} for ad ${adId}`);

    res.json({ success: true });

  } catch (err) {
    console.error("Error tracking click:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin Ad Management API Routes
app.post("/api/admin/ads", checkSuperAdmin, async (req, res) => {
  const { title, content, image_url, target_url, ad_type, display_priority, target_audience } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO system_ads (title, content, image_url, target_url, ad_type, display_priority, target_audience, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             RETURNING id`,
      [title, content, image_url, target_url, ad_type, display_priority || 1, target_audience || 'all']
    );

    // Log activity
    await pool.query(
      "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
      [`New ad created: ${title}`]
    );

    res.json({ success: true, adId: result.rows[0].id });

  } catch (err) {
    console.error("Error creating ad:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/admin/ads/:id", checkSuperAdmin, async (req, res) => {
  const adId = req.params.id;
  const { title, content, image_url, target_url, ad_type, display_priority, target_audience, is_active } = req.body;

  try {
    await pool.query(
      `UPDATE system_ads SET
             title = $1, content = $2, image_url = $3, target_url = $4,
             ad_type = $5, display_priority = $6, target_audience = $7,
             is_active = $8, updated_at = NOW()
             WHERE id = $9`,
      [title, content, image_url, target_url, ad_type, display_priority, target_audience, is_active, adId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Error updating ad:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/admin/ads/:id", checkSuperAdmin, async (req, res) => {
  const adId = req.params.id;

  try {
    await pool.query("DELETE FROM system_ads WHERE id = $1", [adId]);

    // Log activity
    await pool.query(
      "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
      [`Ad deleted: ID ${adId}`]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Error deleting ad:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Activity Tracking API Routes
app.post("/api/activity/start-session", async (req, res) => {
  const { userId, ipAddress, userAgent } = req.body;

  try {
    // Generate session token
    const sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Insert new session
    const result = await pool.query(
      `INSERT INTO user_sessions (user_id, session_token, login_time, last_activity, ip_address, user_agent, created_at)
             VALUES ($1, $2, NOW(), NOW(), $3, $4, NOW())
             RETURNING id`,
      [userId, sessionToken, ipAddress, userAgent]
    );

    // Update user last login
    await pool.query(
      "UPDATE users SET last_login = NOW() WHERE id = $1",
      [userId]
    );

    // Log login activity
    await pool.query(
      "INSERT INTO activities (message, created_at) VALUES ($1, NOW())",
      [`User ${userId} logged in`]
    );

    res.json({ success: true, sessionId: result.rows[0].id });

  } catch (err) {
    console.error("Error starting session:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/activity/update-session", async (req, res) => {
  const { sessionId } = req.body;

  try {
    await pool.query(
      "UPDATE user_sessions SET last_activity = NOW() WHERE id = $1 AND is_active = true",
      [sessionId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Error updating session:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/activity/end-session", async (req, res) => {
  const { sessionId, duration } = req.body;

  try {
    await pool.query(
      "UPDATE user_sessions SET logout_time = NOW(), is_active = false WHERE id = $1",
      [sessionId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Error ending session:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/activity/update-uptime", async (req, res) => {
  const { userId, sessionUptime } = req.body;

  try {
    // Update user's total uptime
    await pool.query(
      "UPDATE users SET total_uptime = total_uptime + $1 WHERE id = $2",
      [sessionUptime, userId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Error updating uptime:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/activity/bulk", async (req, res) => {
  const { activities, sessionId } = req.body;

  if (!Array.isArray(activities) || activities.length === 0) {
    return res.status(400).json({ success: false, message: "Invalid activities data" });
  }

  try {
    // Insert activities in bulk
    const values = activities.map(activity => `(
            ${activity.userId || 'NULL'},
            '${activity.sessionId}',
            '${activity.activityType}',
            '${JSON.stringify(activity.details).replace(/'/g, "''")}',
            '${req.ip || activity.ipAddress || 'unknown'}',
            '${activity.userAgent.replace(/'/g, "''")}',
            '${activity.timestamp}'
        )`).join(', ');

    await pool.query(`
            INSERT INTO user_activity_logs (user_id, session_id, activity_type, details, ip_address, user_agent, created_at)
            VALUES ${values}
        `);

    res.json({ success: true, count: activities.length });

  } catch (err) {
    console.error("Error bulk inserting activities:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get user activity summary
app.get("/api/activity/user-summary/:userId", checkSuperAdmin, async (req, res) => {
  const userId = req.params.userId;

  try {
    // Get user activity stats
    const stats = await pool.query(`
            SELECT
                COUNT(*) as total_activities,
                COUNT(DISTINCT DATE(created_at)) as active_days,
                MAX(created_at) as last_activity,
                COUNT(CASE WHEN activity_type = 'login' THEN 1 END) as login_count,
                COUNT(CASE WHEN activity_type = 'page_view' THEN 1 END) as page_views,
                COUNT(CASE WHEN activity_type = 'click' THEN 1 END) as clicks
            FROM user_activity_logs
            WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
        `, [userId]);

    // Get session stats
    const sessionStats = await pool.query(`
            SELECT
                COUNT(*) as total_sessions,
                AVG(EXTRACT(EPOCH FROM (logout_time - login_time))/60) as avg_session_minutes,
                SUM(EXTRACT(EPOCH FROM (logout_time - login_time))/60) as total_session_minutes
            FROM user_sessions
            WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
        `, [userId]);

    res.json({
      success: true,
      stats: {
        ...stats.rows[0],
        ...sessionStats.rows[0]
      }
    });

  } catch (err) {
    console.error("Error fetching user activity summary:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});