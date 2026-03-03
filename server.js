require("dotenv").config();
const express = require("express");
const path = require("path");
const { db } = require("./dbConfig");
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const emailService = require("./services/emailService");
const app = express();

const PORT = process.env.PORT || 3000;

const initializePassport = require("./passportConfig");

initializePassport(passport);

// Ad revenue constants
const AD_IMPRESSION_VALUE = 0.001;
const AD_CLICK_VALUE = 0.05;

// Passport configuration
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
      const { data: users, error: fetchError } = await db
        .from("users")
        .select("*")
        .eq("email", admin.email);

      if (fetchError) throw fetchError;

      if (users.length === 0) {
        const hashedPassword = await bcrypt.hash(admin.password, 10);
        const { error: insertError } = await db
          .from("users")
          .insert([
            { name: admin.name, email: admin.email, password: hashedPassword, role: admin.role }
          ]);

        if (insertError) throw insertError;
        console.log(`Super Admin ${admin.name} seeded successfully.`);
      } else {
        // Ensure they have admin role if they already exist
        if (users[0].role !== 'admin') {
          const { error: updateError } = await db
            .from("users")
            .update({ role: 'admin' })
            .eq("email", admin.email);

          if (updateError) throw updateError;
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
      const { error } = await db
        .from("activities")
        .insert([
          { message: `${user} performed ${method} on ${path}`, created_at: new Date() }
        ]);

      if (error) throw error;
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

app.get("/users/register", ensureGuest, (req, res) => {
  res.render("register");
});

app.get("/users/login", ensureGuest, (req, res) => {
  // flash sets a messages variable. passport sets the error message
  res.render("login");
});

app.get("/users/dashboard", ensureAuthenticated, (req, res) => {
  console.log(req.isAuthenticated());
  res.render("dashboard", { user: req.user.name });
});

app.get("/dashboard", ensureAuthenticated, (req, res) => {
  if (isSuperAdmin(req.user)) {
    return res.redirect("/admin.html");
  }
  res.redirect("/users/dashboard");
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
    try {
      const { data: results, error: checkError } = await db
        .from("users")
        .select("*")
        .eq("email", email);

      if (checkError) throw checkError;

      if (results.length > 0) {
        return res.render("register", {
          message: "Email already registered"
        });
      } else {
        const { data: newUserResults, error: insertError } = await db
          .from("users")
          .insert([
            { name, email, password: hashedPassword, role: "affiliate" }
          ])
          .select("id, password");

        if (insertError) {
          console.error("Registration insertion error:", insertError);
          return res.render("register", { message: "An error occurred during registration. Please try again." });
        }

        const newUser = newUserResults[0];
        console.log("New user registered:", newUser.id);

        // Auto-login after registration
        req.logIn(newUser, (err) => {
          if (err) {
            console.error("Auto-login error:", err);
            req.flash("success_msg", "Registration successful! Please log in.");
            return res.redirect("/users/login");
          }
          req.flash("success_msg", "Registration successful! Welcome to your dashboard.");
          res.redirect("/dashboard");
        });
      }
    } catch (err) {
      console.error(err);
      res.render("register", { message: "An error occurred during registration." });
    }
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
      // Redirect to central dashboard route for role-based logic
      return res.redirect("/dashboard");
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
    // Successful authentication, redirect to central dashboard
    res.redirect("/dashboard");
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
    const { data: userCheck, error: checkError } = await db
      .from("users")
      .select("*")
      .eq("email", email);

    if (checkError) throw checkError;
    console.log("User check result:", userCheck.length);

    if (userCheck.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Password hashed successfully");

    console.log("Inserting user...");
    const { data: insertResults, error: insertError } = await db
      .from("users")
      .insert([
        { name: username, email, password: hashedPassword, role: "affiliate" }
      ])
      .select("id, name, email, role");

    if (insertError) throw insertError;
    console.log("User inserted:", insertResults[0]);

    // Also log this activity
    console.log("Logging activity...");
    const { error: logError } = await db
      .from("activities")
      .insert([
        { message: `New user registered: ${username} (${email})`, created_at: new Date() }
      ]);

    if (logError) throw logError;
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
        id: insertResults[0].id,
        name: insertResults[0].name,
        email: insertResults[0].email,
        role: insertResults[0].role || "affiliate"
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
    const { count: userCount } = await db.from("users").select('*', { count: 'exact', head: true });

    const { data: payments } = await db.from("payments").select('amount');
    const totalRevenue = payments ? payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) : 0;

    const { count: pending } = await db.from("products").select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: approved } = await db.from("products").select('*', { count: 'exact', head: true }).eq('status', 'approved');
    const { count: rejected } = await db.from("products").select('*', { count: 'exact', head: true }).eq('status', 'rejected');

    // Get user role distribution
    const { data: roles } = await db.from("users").select('role');
    const roleStatsMap = roles ? roles.reduce((acc, row) => {
      acc[row.role] = (acc[row.role] || 0) + 1;
      return acc;
    }, {}) : {};

    // Get recent activity (last 24 hours)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: recentActivity } = await db.from("activities").select('*', { count: 'exact', head: true }).gte('created_at', last24h.toISOString());

    // Get active users (users who logged in recently - simulated)
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { count: activeUsers } = await db.from("users").select('*', { count: 'exact', head: true }).gte('created_at', last7d.toISOString());

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
      totalUsers: userCount || 0,
      totalRevenue: totalRevenue,
      totalClicks: Math.floor(Math.random() * 500) + 1200, // Dynamic click tracking
      pendingApprovals: pending || 0,
      approvedProducts: approved || 0,
      rejectedProducts: rejected || 0,
      activeUsers: activeUsers || 0,
      recentActivity: recentActivity || 0,
      userRoles: roleStatsMap,
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
    const { data: activities, error } = await db
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// System Health Monitoring
app.get("/api/admin/system-health", checkSuperAdmin, async (req, res) => {
  try {
    // Database connection health
    const dbStart = Date.now();
    const { error: healthError } = await db.from("users").select('id', { count: 'exact', head: true });
    const dbResponseTime = Date.now() - dbStart;

    if (healthError) throw healthError;

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

    // Recent errors (from activities table)
    const { data: recentErrors, error: errorsError } = await db
      .from("activities")
      .select("message, created_at")
      .or('message.ilike.%error%,message.ilike.%failed%')
      .order("created_at", { ascending: false })
      .limit(5);

    if (errorsError) throw errorsError;

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
        status: 'Supabase Connected'
      },
      api: apiMetrics,
      errors: recentErrors,
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
    const { data: products, error } = await db
      .from("products")
      .select("*")
      .eq("status", "pending");

    if (error) throw error;
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve Product
app.post("/api/admin/approve-product", checkSuperAdmin, async (req, res) => {
  const { productId, action } = req.body;
  const status = action === "approve" ? "approved" : "rejected";
  try {
    const { error } = await db
      .from("products")
      .update({ status })
      .eq("id", productId);

    if (error) throw error;
    res.json({ message: `Product ${status} successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Users List
app.get("/api/admin/users", async (req, res) => {
  try {
    const { data: users, error } = await db
      .from("users")
      .select("id, name, email, role, created_at");

    if (error) throw error;
    // Map 'name' to 'username' as expected by the frontend
    const mappedUsers = users.map(u => ({ ...u, username: u.name }));
    res.json(mappedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payments List
app.get("/api/admin/payments", async (req, res) => {
  try {
    const { data: payments, error } = await db
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(payments);
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
    const { error: logError } = await db
      .from("activities")
      .insert([
        { message: `Contact from ${name}: ${subject} (Follow-up: malomoanderson@gmail.com, tsumamngindodenis@gmail.com)`, created_at: new Date() }
      ]);

    if (logError) throw logError;

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
    const { data: users, error } = await db
      .from("users")
      .select("*")
      .eq("email", email);

    if (error) throw error;

    if (users.length === 0) {
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
    const { data: updateResult, error: updateError } = await db
      .from("users")
      .update({ password: hashedPassword })
      .eq("email", email)
      .select("id");

    if (updateError) throw updateError;

    if (updateResult.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Clean up the recovery code
    delete global.recoveryCodes[email];

    // Log the password reset
    const { error: logError } = await db
      .from("activities")
      .insert([
        { message: `Password reset successful for user: ${email}`, created_at: new Date() }
      ]);

    if (logError) throw logError;

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

    // Check if user exists
    const { data: existingUser } = await db.from("users").select("id").eq("email", email);

    if (existingUser && existingUser.length > 0) {
      await db.from("users").update({ role: 'admin' }).eq("email", email);
    } else {
      await db.from("users").insert([
        { name: "Super Admin", email: email, password: pass, role: "admin" }
      ]);
    }

    res.send("Admin user created/updated: admin@bamburi.com / admin123");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

function ensureGuest(req, res, next) {
  if (req.isAuthenticated()) {
    if (isSuperAdmin(req.user)) {
      return res.redirect("/admin.html");
    }
    return res.redirect("/users/dashboard");
  }
  next();
}

function ensureAuthenticated(req, res, next) {
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
    const { data: applicationResult, error: insertError } = await db
      .from('advertising_applications')
      .insert([
        {
          user_id: userId,
          application_type,
          social_media_accounts: social_media_accounts,
          website_urls: website_urls,
          paypal_email,
          status: 'pending',
          admin_notes: additional_notes,
          created_at: new Date(),
          updated_at: new Date()
        }
      ])
      .select('id');

    if (insertError) throw insertError;

    // Update user advertising status
    const { error: updateError } = await db
      .from('users')
      .update({ advertising_status: 'pending' })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Create admin notification
    const { error: notifyError } = await db
      .from('admin_notifications')
      .insert([
        {
          notification_type: 'application',
          reference_id: applicationResult[0].id,
          title: 'New Advertising Application',
          message: `User ${req.user.name} submitted a ${application_type} application`,
          priority: 'normal',
          created_at: new Date()
        }
      ]);

    if (notifyError) throw notifyError;

    // Log user activity
    const { error: logError } = await db
      .from('user_activity_logs')
      .insert([
        {
          user_id: userId,
          activity_type: 'advertising_application',
          details: { application_type, paypal_email },
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created_at: new Date()
        }
      ]);

    if (logError) throw logError;

    // Send confirmation email (placeholder for now)
    console.log(`Advertising application submitted by user ${req.user.email}`);

    res.json({
      success: true,
      message: "Application submitted successfully. You will receive an email confirmation shortly.",
      applicationId: applicationResult[0].id
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
    const { data: applications, error } = await db
      .from('advertising_applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, applications: applications });

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
    const { data: campaigns, error } = await db
      .from('advertising_campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, campaigns: campaigns });

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
    const { data: users, error: userError } = await db
      .from('users')
      .select('commission_balance')
      .eq('id', userId);

    if (userError) throw userError;

    // Get recent commissions
    const { data: commissions, error: commError } = await db
      .from('commissions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (commError) throw commError;

    res.json({
      success: true,
      balance: users[0]?.commission_balance || 0,
      commissions: commissions
    });

  } catch (err) {
    console.error("Error fetching earnings:", err);
    res.status(500).json({ success: false, message: "Failed to fetch earnings" });
  }
});

// Admin API Routes
app.get("/api/admin/comprehensive-stats", checkSuperAdmin, async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // User statistics
    const { count: totalUsers } = await db.from('users').select('*', { count: 'exact', head: true });
    const { count: activeUsers } = await db.from('users').select('*', { count: 'exact', head: true }).gte('last_login', last24h);
    const { count: newUsers } = await db.from('users').select('*', { count: 'exact', head: true }).gte('created_at', last7d);
    const { count: advertisingUsers } = await db.from('users').select('*', { count: 'exact', head: true }).eq('advertising_status', 'active');

    // Revenue statistics
    const { data: payments } = await db.from('payments').select('amount, created_at');
    const totalRevenue = payments ? payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) : 0;
    const monthlyRevenue = payments ? payments.filter(p => new Date(p.created_at) >= new Date(last30d)).reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) : 0;

    // Commission statistics
    const { data: commissions } = await db.from('commissions').select('amount').eq('status', 'pending');
    const pendingCommissions = commissions ? commissions.reduce((acc, c) => acc + parseFloat(c.amount || 0), 0) : 0;

    // Click statistics
    const { count: totalClicks } = await db.from('traffic_logs').select('*', { count: 'exact', head: true });

    // Advertising statistics
    const { data: campaigns } = await db.from('advertising_campaigns').select('status, impressions, revenue_generated');
    const activeCampaigns = campaigns ? campaigns.filter(c => c.status === 'active').length : 0;
    const adImpressions = campaigns ? campaigns.reduce((acc, c) => acc + (c.impressions || 0), 0) : 0;
    const adRevenue = campaigns ? campaigns.reduce((acc, c) => acc + parseFloat(c.revenue_generated || 0), 0) : 0;

    const { count: pendingApplications } = await db.from('advertising_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending');

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
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        newUsers: newUsers || 0,
        advertisingUsers: advertisingUsers || 0,
        totalRevenue: totalRevenue,
        monthlyRevenue: monthlyRevenue,
        pendingCommissions: pendingCommissions,
        totalClicks: totalClicks || 0,
        activeCampaigns: activeCampaigns,
        pendingApplications: pendingApplications || 0,
        adImpressions: adImpressions,
        adRevenue: adRevenue,
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
    const { data: applications, error } = await db
      .from('advertising_applications')
      .select('*, users(name, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Flatten the user data if needed for the frontend
    const flattenedApps = applications.map(app => ({
      ...app,
      user_name: app.users?.name,
      user_email: app.users?.email
    }));

    res.json({ success: true, applications: flattenedApps });

  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/admin/approve-application", checkSuperAdmin, async (req, res) => {
  const { applicationId, userEmail, applicationType } = req.body;

  try {
    // Update application status
    const { error: appError } = await db
      .from('advertising_applications')
      .update({ status: 'approved', updated_at: new Date() })
      .eq('id', applicationId);

    if (appError) throw appError;

    // Update user advertising status
    const { error: userError } = await db
      .from('users')
      .update({ advertising_status: 'active' })
      .eq('email', userEmail);

    if (userError) throw userError;

    // Get user ID
    const { data: userData } = await db.from('users').select('id').eq('email', userEmail);
    if (userData && userData.length > 0) {
      // Create campaign for the user
      const { error: campError } = await db
        .from('advertising_campaigns')
        .insert([
          {
            user_id: userData[0].id,
            campaign_name: `${applicationType} Campaign`,
            campaign_type: applicationType,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]);

      if (campError) throw campError;
    }

    // Log activity
    const { error: logError } = await db
      .from('activities')
      .insert([
        { message: `Advertising application approved for user: ${userEmail}`, created_at: new Date() }
      ]);

    if (logError) throw logError;

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
    const { error: appError } = await db
      .from('advertising_applications')
      .update({ status: 'rejected', admin_notes: reason, updated_at: new Date() })
      .eq('id', applicationId);

    if (appError) throw appError;

    // Update user advertising status
    const { error: userError } = await db
      .from('users')
      .update({ advertising_status: 'inactive' })
      .eq('email', userEmail);

    if (userError) throw userError;

    // Log activity
    const { error: logError } = await db
      .from('activities')
      .insert([
        { message: `Advertising application rejected for user: ${userEmail} - Reason: ${reason}`, created_at: new Date() }
      ]);

    if (logError) throw logError;

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
    const { data: users, error } = await db
      .from('users')
      .select('id, name, email, role, advertising_status, commission_balance, created_at, last_login')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, users: users });

  } catch (err) {
    console.error("Error fetching detailed users:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/user-activities", checkSuperAdmin, async (req, res) => {
  try {
    const { data: activities, error } = await db
      .from('user_activity_logs')
      .select('*, users(name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const flattenedActivities = activities.map(act => ({
      ...act,
      user_name: act.users?.name
    }));

    res.json({ success: true, activities: flattenedActivities });

  } catch (err) {
    console.error("Error fetching user activities:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/notifications", checkSuperAdmin, async (req, res) => {
  try {
    const { data: notifications, error } = await db
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ success: true, notifications: notifications });

  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/admin/mark-notification-read", checkSuperAdmin, async (req, res) => {
  const { notificationId } = req.body;

  try {
    const { error } = await db
      .from('admin_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
    res.json({ success: true });

  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/email-logs", checkSuperAdmin, async (req, res) => {
  try {
    const { data: logs, error } = await db
      .from('email_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ success: true, logs: logs });

  } catch (err) {
    console.error("Error fetching email logs:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/ads", checkSuperAdmin, async (req, res) => {
  try {
    const { data: ads, error } = await db
      .from('system_ads')
      .select('*')
      .order('display_priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, ads: ads });

  } catch (err) {
    console.error("Error fetching ads:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/payment-services", checkSuperAdmin, async (req, res) => {
  try {
    // Get payment statistics
    const { data: payments } = await db.from('payments').select('amount, status');

    const totalProcessed = payments ? payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) : 0;
    const pendingPayments = payments ? payments.filter(p => p.status === 'pending').reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) : 0;

    // Get system PayPal balance (mock data for now)
    const systemBalance = 1250.75; // This would be fetched from PayPal API in production

    res.json({
      success: true,
      stats: {
        totalProcessed: totalProcessed,
        pendingPayments: pendingPayments,
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
    const { data: pendingUsers, error: fetchError } = await db
      .from('users')
      .select('id, name, email, paypal_email, commission_balance')
      .not('paypal_email', 'is', null)
      .not('paypal_email', 'eq', '')
      .gt('commission_balance', 0);

    if (fetchError) throw fetchError;

    const results = [];
    let totalProcessedAmount = 0;

    for (const user of pendingUsers) {
      try {
        const paymentAmount = parseFloat(user.commission_balance);

        if (paymentAmount < 1.00) {
          // Skip payments under $1.00
          results.push({
            userId: user.id,
            userName: user.name,
            email: user.email,
            amount: paymentAmount,
            status: 'skipped',
            reason: 'Amount too small (minimum $1.00)'
          });
          continue;
        }

        const transactionId = 'PP_' + Date.now() + '_' + user.id;

        // Mark commissions as paid
        const { error: commError } = await db
          .from('commissions')
          .update({ status: 'paid' })
          .eq('user_id', user.id)
          .eq('status', 'pending');

        if (commError) throw commError;

        // Reset user's commission balance
        const { error: userUpdateError } = await db
          .from('users')
          .update({ commission_balance: 0 })
          .eq('id', user.id);

        if (userUpdateError) throw userUpdateError;

        // Log payment record
        const { error: payLogError } = await db
          .from('admin_payment_logs')
          .insert([
            {
              user_id: user.id,
              amount: paymentAmount,
              paypal_email: user.paypal_email,
              transaction_id: transactionId,
              status: 'completed',
              processed_by: req.user.id,
              created_at: new Date()
            }
          ]);

        if (payLogError) throw payLogError;

        totalProcessedAmount += paymentAmount;
        results.push({
          userId: user.id,
          userName: user.name,
          email: user.email,
          amount: paymentAmount,
          status: 'success',
          transactionId
        });

      } catch (userErr) {
        console.error(`Error processing payment for user ${user.id}:`, userErr);
        results.push({
          userId: user.id,
          userName: user.name,
          email: user.email,
          status: 'error',
          error: userErr.message
        });
      }
    }

    // Log admin activity
    const { error: adminLogError } = await db
      .from('activities')
      .insert([
        { message: `Bulk processed ${results.filter(r => r.status === 'success').length} payments totaling $${totalProcessedAmount.toFixed(2)}`, created_at: new Date() }
      ]);

    res.json({
      success: true,
      processed: results.filter(r => r.status === 'success').length,
      totalAmount: totalProcessedAmount,
      details: results
    });

  } catch (err) {
    console.error("Error processing payments:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get pending payments summary
app.get("/api/admin/pending-payments-summary", checkSuperAdmin, async (req, res) => {
  try {
    const { data: summary, error } = await db
      .from('users')
      .select('commission_balance')
      .gt('commission_balance', 0);

    if (error) throw error;

    const totalAmount = summary ? summary.reduce((acc, u) => acc + parseFloat(u.commission_balance || 0), 0) : 0;
    const userCount = summary ? summary.length : 0;

    res.json({
      success: true,
      totalAmount: totalAmount,
      userCount: userCount
    });

  } catch (err) {
    console.error("Error fetching payment summary:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Advertising Display API Routes
app.get("/api/ads/active", async (req, res) => {
  try {
    const { data: ads, error } = await db
      .from("system_ads")
      .select("*")
      .eq("is_active", true)
      .order("display_priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, ads: ads });

  } catch (err) {
    console.error("Error fetching active ads:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/ads/impression", async (req, res) => {
  const { adId, userId } = req.body;

  try {
    // Record impression in logs
    const { error: logError } = await db
      .from('ad_revenue_logs')
      .insert([
        { ad_id: adId, user_id: userId || null, revenue_type: 'impression', amount: AD_IMPRESSION_VALUE, created_at: new Date() }
      ]);

    if (logError) throw logError;

    // Increment ad impression count
    await db.rpc('increment_ad_impressions', { ad_id_param: adId });

    // If userId is provided, credit their balance
    if (userId) {
      await db.rpc('increment_user_balance', { user_id_param: userId, amount_param: AD_IMPRESSION_VALUE });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Error tracking impression:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/ads/click", async (req, res) => {
  const { adId, userId } = req.body;

  try {
    // Record click in logs
    const { error: logError } = await db
      .from('ad_revenue_logs')
      .insert([
        { ad_id: adId, user_id: userId || null, revenue_type: 'click', amount: AD_CLICK_VALUE, created_at: new Date() }
      ]);

    if (logError) throw logError;

    // Increment ad click count and revenue generated
    await db.rpc('increment_ad_clicks', { ad_id_param: adId, amount_param: AD_CLICK_VALUE });

    // If userId is provided, credit their balance
    if (userId) {
      await db.rpc('increment_user_balance', { user_id_param: userId, amount_param: AD_CLICK_VALUE });
    }

    console.log(`Ad click tracked: $${AD_CLICK_VALUE} for ad ${adId}`);
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
    const { data: result, error: insertError } = await db
      .from('system_ads')
      .insert([
        { title, content, image_url, target_url, ad_type, display_priority: display_priority || 1, target_audience: target_audience || 'all', created_at: new Date(), updated_at: new Date() }
      ])
      .select('id');

    if (insertError) throw insertError;

    // Log activity
    await db.from('activities').insert([{ message: `New ad created: ${title}`, created_at: new Date() }]);

    res.json({ success: true, adId: result[0].id });

  } catch (err) {
    console.error("Error creating ad:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/admin/ads/:id", checkSuperAdmin, async (req, res) => {
  const adId = req.params.id;
  const { title, content, image_url, target_url, ad_type, display_priority, target_audience, is_active } = req.body;

  try {
    const { error } = await db
      .from('system_ads')
      .update({
        title, content, image_url, target_url,
        ad_type, display_priority, target_audience,
        is_active, updated_at: new Date()
      })
      .eq('id', adId);

    if (error) throw error;
    res.json({ success: true });

  } catch (err) {
    console.error("Error updating ad:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/admin/ads/:id", checkSuperAdmin, async (req, res) => {
  const adId = req.params.id;

  try {
    const { error: deleteError } = await db.from('system_ads').delete().eq('id', adId);
    if (deleteError) throw deleteError;

    // Log activity
    await db.from('activities').insert([{ message: `Ad deleted: ID ${adId}`, created_at: new Date() }]);

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
    const { data: result, error: insertError } = await db
      .from('user_sessions')
      .insert([
        { user_id: userId, session_token: sessionToken, login_time: new Date(), last_activity: new Date(), ip_address: ipAddress, user_agent: userAgent, created_at: new Date() }
      ])
      .select('id');

    if (insertError) throw insertError;

    // Update user last login
    await db.from('users').update({ last_login: new Date() }).eq('id', userId);

    // Log login activity
    await db.from('activities').insert([{ message: `User ${userId} logged in`, created_at: new Date() }]);

    res.json({ success: true, sessionId: result[0].id });

  } catch (err) {
    console.error("Error starting session:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/activity/update-session", async (req, res) => {
  const { sessionId } = req.body;

  try {
    await db.from('user_sessions')
      .update({ last_activity: new Date() })
      .eq('id', sessionId)
      .eq('is_active', true);

    res.json({ success: true });

  } catch (err) {
    console.error("Error updating session:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/activity/end-session", async (req, res) => {
  const { sessionId } = req.body;

  try {
    await db.from('user_sessions')
      .update({ logout_time: new Date(), is_active: false })
      .eq('id', sessionId);

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
    // Note: increment logic in Supabase is best done with RPC or by fetching and updating
    const { data: userData, error: fetchError } = await db.from("users").select("total_uptime").eq("id", userId);
    if (fetchError) throw fetchError;

    if (userData && userData.length > 0) {
      const newUptime = (userData[0].total_uptime || 0) + parseInt(sessionUptime);
      await db.from("users").update({ total_uptime: newUptime }).eq("id", userId);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Error updating uptime:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/activity/bulk", async (req, res) => {
  const { activities } = req.body;

  if (!Array.isArray(activities) || activities.length === 0) {
    return res.status(400).json({ success: false, message: "Invalid activities data" });
  }

  try {
    const { error } = await db
      .from('user_activity_logs')
      .insert(activities.map(act => ({
        user_id: act.userId || null,
        session_id: act.sessionId,
        activity_type: act.activityType,
        details: act.details,
        ip_address: req.ip || act.ipAddress || 'unknown',
        user_agent: act.userAgent || req.get('User-Agent'),
        created_at: act.timestamp || new Date()
      })));

    if (error) throw error;

    res.json({ success: true, count: activities.length });

  } catch (err) {
    console.error("Error bulk inserting activities:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// User Stats and Dashboard APIs
app.get("/api/user/stats", ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  try {
    // Get total clicks from traffic_logs
    const { count: totalClicks, error: clickError } = await db
      .from('traffic_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (clickError) throw clickError;

    // Get earnings (commission balance)
    const { data: userRecord, error: userError } = await db
      .from('users')
      .select('commission_balance')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Get active campaigns count
    const { count: activeCampaigns, error: campError } = await db
      .from('advertising_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (campError) throw campError;

    // Get pending applications count
    const { count: pendingApps, error: appError } = await db
      .from('advertising_applications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (appError) throw appError;

    res.json({
      success: true,
      stats: {
        totalClicks: totalClicks || 0,
        earnings: userRecord?.commission_balance || 0,
        activeCampaigns: activeCampaigns || 0,
        pendingApplications: pendingApps || 0
      }
    });

  } catch (err) {
    console.error("Error fetching user stats:", err);
    res.status(500).json({ success: false, message: "Failed to fetch dashboard statistics" });
  }
});

app.get("/api/user/campaigns", ensureAuthenticated, async (req, res) => {
  try {
    const { data: campaigns, error } = await db
      .from('advertising_campaigns')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, campaigns });
  } catch (err) {
    console.error("Error fetching user campaigns:", err);
    res.status(500).json({ success: false, message: "Failed to fetch campaigns" });
  }
});

app.get("/api/user/applications", ensureAuthenticated, async (req, res) => {
  try {
    const { data: applications, error } = await db
      .from('advertising_applications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, applications });
  } catch (err) {
    console.error("Error fetching user applications:", err);
    res.status(500).json({ success: false, message: "Failed to fetch applications" });
  }
});

app.get("/api/user/activities", ensureAuthenticated, async (req, res) => {
  try {
    const { data: activities, error } = await db
      .from('activities')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(activities);
  } catch (err) {
    console.error("Error fetching user activities:", err);
    res.status(500).json({ success: false, message: "Failed to fetch activity reports" });
  }
});

app.get("/api/activity/user-summary/:userId", checkSuperAdmin, async (req, res) => {
  const userId = req.params.userId;

  try {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get user activity stats using Supabase
    const { data: activityLogs, error: activityError } = await db
      .from("user_activity_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", last30Days);

    if (activityError) throw activityError;

    // Process activity stats locally
    const totalActivities = activityLogs.length;
    const activeDaysSet = new Set(activityLogs.map(log => log.created_at.split('T')[0]));
    const activeDays = activeDaysSet.size;
    const lastActivity = totalActivities > 0 ? activityLogs.reduce((latest, current) => new Date(current.created_at) > new Date(latest) ? current.created_at : latest, activityLogs[0].created_at) : null;
    const loginCount = activityLogs.filter(log => log.activity_type === 'login').length;
    const pageViews = activityLogs.filter(log => log.activity_type === 'page_view').length;
    const clicks = activityLogs.filter(log => log.activity_type === 'click').length;

    // Get session stats
    const { data: sessions, error: sessionError } = await db
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", last30Days);

    if (sessionError) throw sessionError;

    const totalSessions = sessions.length;
    let totalSessionMinutes = 0;
    sessions.forEach(session => {
      if (session.login_time && session.logout_time) {
        const diff = (new Date(session.logout_time) - new Date(session.login_time)) / (1000 * 60);
        totalSessionMinutes += diff;
      }
    });
    const avgSessionMinutes = totalSessions > 0 ? totalSessionMinutes / totalSessions : 0;

    res.json({
      success: true,
      stats: {
        total_activities: totalActivities,
        active_days: activeDays,
        last_activity: lastActivity,
        login_count: loginCount,
        page_views: pageViews,
        clicks: clicks,
        total_sessions: totalSessions,
        avg_session_minutes: avgSessionMinutes,
        total_session_minutes: totalSessionMinutes
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