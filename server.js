require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");
const { db } = require("./dbConfig");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const emailService = require("./services/emailService");
const app = express();
const helmet = require("helmet");
const cors = require("cors");
const { generalLimiter, authLimiter, emailLimiter } = require("./middleware/rateLimiter");
const logger = require("./utils/logger");
const { redirectValidator } = require("./middleware/redirectValidator");
const customSanitizer = require("./middleware/sanitizer");
const compression = require("compression");

const PORT = process.env.PORT || 3000;

const initializePassport = require("./passportConfig");

initializePassport(passport);

// Ad revenue constants
const AD_IMPRESSION_VALUE = 0.001;
const AD_CLICK_VALUE = 0.05;

// Passport configuration (SUPER_ADMINS fallback removed, now purely role-based)
const SUPER_ADMINS = []; // Kept as empty for legacy compatibility if needed elsewhere

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

const ADMIN_EMAILS = process.env.ADMIN_EMAILS || 'tsumamngindodenis@gmail.com,malomoanderson@gmail.com';

function isSuperAdmin(user) {
  if (!user) return false;
  return user.role === 'admin';
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
        logger.info(`Super Admin ${admin.name} seeded successfully.`);
      } else {
        // Ensure they have admin role if they already exist
        if (users[0].role !== 'admin') {
          const { error: updateError } = await db
            .from("users")
            .update({ role: 'admin' })
            .eq("email", admin.email);

          if (updateError) throw updateError;
          logger.info(`Super Admin ${admin.name} role updated to admin.`);
        } else {
          logger.debug(`Super Admin ${admin.name} already exists and is admin.`);
        }
      }
    }
  } catch (err) {
    logger.error("Seeding failed", { error: err.message });
  }
}
// Execute seeding only if not in a Vercel build environment and DB is available
if (process.env.VERCEL !== '1') {
  seedSuperAdmins();
} else {
  logger.info("Skipping automatic seeding in Vercel environment.");
}

// User Action Logger Middleware (non-blocking - fires in background)
function logAction(req, res, next) {
  // Call next immediately so login/register never waits for this
  next();

  // Log only meaningful write operations asynchronously
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const user = req.user ? req.user.email : 'anonymous';
    // Fire-and-forget: intentionally NOT awaited
    db.from("activities")
      .insert([{ message: `${user} performed ${req.method} on ${req.path}`, created_at: new Date() }])
      .then(({ error }) => {
        if (error) logger.warn("Activity log insert failed (non-critical)", { error: error.message });
      })
      .catch(err => {
        logger.warn("Activity log error (non-critical)", { error: err.message });
      });
  }
}

// Password Validation Function (Moved to routes/auth.js)

// Super Admin Middleware
function checkSuperAdmin(req, res, next) {
  // 1. Check Passport Session first
  if (req.user && isSuperAdmin(req.user)) {
    return next();
  }

  // 2. Fallback to Token verification (check both cookie and header)
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) {
    logger.warn('Unauthorized admin dashboard access attempt', { path: req.path, ip: req.ip });
    if (req.path.startsWith('/api')) {
      return res.status(403).json({ error: "Access denied. Super Admin privileges required." });
    }
    return res.redirect("/users/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'aceos-secret-key');
    if (decoded.role !== 'admin') {
      logger.warn('Access denied for non-admin user to dashboard', { userId: decoded.id, role: decoded.role });
      if (req.path.startsWith('/api')) {
        return res.status(403).json({ error: "Access denied. Super Admin privileges required." });
      }
      return res.redirect("/users/dashboard");
    }
    req.user = decoded;
    next();
  } catch (err) {
    logger.error('Invalid token for admin dashboard access', { error: err.message });
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }
    res.redirect("/users/login");
  }
}

// CDN Configuration for faster loading
const CDN_CONFIG = {
  enabled: process.env.NODE_ENV === 'production',
  baseUrl: process.env.CDN_BASE_URL || 'https://cdn.jsdelivr.net',
  assets: {
    // Bootstrap
    bootstrapCss: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    bootstrapJs: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',

    // Font Awesome
    fontAwesome: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',

    // jQuery
    jquery: 'https://code.jquery.com/jquery-3.7.0.min.js',

    // Chart.js for analytics
    chartJs: 'https://cdn.jsdelivr.net/npm/chart.js',

    // Local assets fallback
    local: {
      css: '/css/',
      js: '/js/',
      images: '/images/',
      fonts: '/fonts/'
    }
  }
};

// CDN Middleware for static assets
app.use('/css', (req, res, next) => {
  if (CDN_CONFIG.enabled) {
    // Add cache headers for CDN assets
    res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
    res.set('CDN-Cache-Control', 'max-age=31536000');
  }
  next();
});

app.use('/js', (req, res, next) => {
  if (CDN_CONFIG.enabled) {
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('CDN-Cache-Control', 'max-age=31536000');
  }
  next();
});

// CDN Route handlers for optimized asset serving
app.get('/cdn/bootstrap.css', (req, res) => {
  if (CDN_CONFIG.enabled) {
    res.redirect(302, CDN_CONFIG.assets.bootstrapCss);
  } else {
    res.sendFile(path.join(__dirname, 'node_modules/bootstrap/dist/css/bootstrap.min.css'));
  }
});

app.get('/cdn/bootstrap.js', (req, res) => {
  if (CDN_CONFIG.enabled) {
    res.redirect(302, CDN_CONFIG.assets.bootstrapJs);
  } else {
    res.sendFile(path.join(__dirname, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js'));
  }
});

app.get('/cdn/font-awesome.css', (req, res) => {
  if (CDN_CONFIG.enabled) {
    res.redirect(302, CDN_CONFIG.assets.fontAwesome);
  } else {
    res.sendFile(path.join(__dirname, 'css/font-awesome.css'));
  }
});

app.get('/cdn/jquery.js', (req, res) => {
  if (CDN_CONFIG.enabled) {
    res.redirect(302, CDN_CONFIG.assets.jquery);
  } else {
    res.sendFile(path.join(__dirname, 'js/jquery.js'));
  }
});

app.get('/cdn/chart.js', (req, res) => {
  if (CDN_CONFIG.enabled) {
    res.redirect(302, CDN_CONFIG.assets.chartJs);
  } else {
    res.sendFile(path.join(__dirname, 'node_modules/chart.js/dist/chart.umd.js'));
  }
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(origin => origin.length > 0);

app.use(cors({
  origin: function (origin, callback) {
    // 1. Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // 2. Clear matches from whitelist
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // 3. Automated support for localhost same-port dev
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }

    // 4. Fallback: Block
    const msg = 'The CORS policy for this site does not allow access from the specified Origin: ' + origin;
    return callback(new Error(msg), false);
  },
  credentials: true
}));

app.use(customSanitizer); // Custom Express 5 compatible sanitizer
app.use(redirectValidator); // Validate all redirects
app.use("/api/", generalLimiter); // Apply general rate limit to all API routes
app.use("/api/auth/login", authLimiter); // Apply stricter limit to login
app.use("/api/auth/register", authLimiter); // Apply stricter limit to register
app.use("/api/auth/forgot-password", emailLimiter); // Apply stricter limit to email attempts
app.use("/api/auth/reset-password", emailLimiter); // Apply stricter limit to email attempts

// CRITICAL: Body parsers MUST be registered before any routes so req.body is populated
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set("view engine", "ejs");
app.use(cookieParser());

// Trust Vercel's proxy properly so secure cookies work over HTTPS
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'aceos-fallback-session-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(logAction);

// Static file serving with caching
const cacheOptions = {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
};
app.use(express.static(path.join(__dirname, "public"), cacheOptions));
app.use(express.static(path.join(__dirname, "views"), cacheOptions));
app.use("/js", express.static(path.join(__dirname, "js"), cacheOptions));
app.use("/css", express.static(path.join(__dirname, "css"), cacheOptions));
app.use("/images", express.static(path.join(__dirname, "images"), cacheOptions));
app.use("/fonts", express.static(path.join(__dirname, "fonts"), cacheOptions));
app.use(express.static(path.join(__dirname, "users"), cacheOptions));

// Mount API routes
const authRouter = require('./routes/auth');
const productsRouter = require('./routes/products');
const affiliateRouter = require('./routes/affiliate');
const adminRouter = require('./routes/admin');
const paypalRouter = require('./routes/paypal');
const advertisingRouter = require('./routes/advertising');
const trackingRouter = require('./routes/tracking');
const profileRouter = require('./routes/profile');

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/affiliate', affiliateRouter);
app.use('/api/admin', adminRouter);
app.use('/api/paypal', paypalRouter);
app.use('/api/advertising', advertisingRouter);
app.use('/api/tracking', trackingRouter);
app.use('/api/profile', profileRouter);

// Static serving for profile uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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

// Dashboard routes for authenticated users (both Passport session and JWT token supported)
app.get("/dashboard-products.html", ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard-products.html"));
});

app.get("/dashboard-commerce.html", ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard-commerce.html"));
});

app.get("/dashboard-advertising.html", ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard-advertising.html"));
});

app.get("/dashboard-signal.html", ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard-signal.html"));
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
  const role = req.user.role || 'affiliate';
  if (role === 'admin') {
    return res.redirect("/admin.html");
  } else if (role === 'affiliate') {
    return res.redirect("/users/dashboard");
  }
  res.redirect("/");
});

app.get("/users/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    req.flash("success_msg", "You have logged out successfully");
    res.redirect("/users/login");
  });
});

// Google OAuth Routes
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/users/login" }),
  (req, res) => {
    // Successful authentication, issue JWT token for frontend functionality
    const userRole = req.user.role || 'affiliate';
    const token = jwt.sign(
        { id: req.user.id, email: req.user.email, role: userRole, name: req.user.name },
        process.env.JWT_SECRET || 'aceos-secret-key',
        { expiresIn: '24h' }
    );
    
    // Sync backend cookie state
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    });

    // Redirect to static frontends with query parameters so js/auth.js can cache the state
    const query = `?token=${token}&role=${userRole}&id=${req.user.id}&name=${encodeURIComponent(req.user.name)}`;
    if (userRole === 'admin') {
      res.redirect("/admin.html" + query);
    } else {
      res.redirect("/users/dashboard" + query);
    }
  }
);

// API Auth and Admin routes are handled by the routers mounted above.
// (Duplicate registrations removed — do not re-add require() calls here)

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
    logger.info(`[EMAIL NOTIFICATION] To: info@aceos.com (Mock)`);
    logger.debug(`[CONTENT] Name: ${name}, Email: ${email}, Phone: ${phone}, Message: ${message}`);

    res.json({ success: true, message: "Thank you! Our team has been notified and will follow up with you shortly." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Legacy forgot password logic removed. Now handled by /api/auth router.

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
    // Redirect to a single dashboard route, which will handle role-based splitting
    return res.redirect("/dashboard");
  }
  // Also check JWT token
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'aceos-secret-key');
      return res.redirect("/dashboard");
    } catch (err) {
      // Token invalid, continue to login
    }
  }
  next();
}

function ensureAuthenticated(req, res, next) {
  // 1. Check Passport Session first
  if (req.isAuthenticated()) {
    return next();
  }

  // 2. Fallback to Token verification (check both cookie and header)
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) {
    logger.warn('Unauthorized access attempt to protected route', { path: req.path, ip: req.ip });
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: "Authentication required. Please log in." });
    }
    return res.redirect("/users/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'aceos-secret-key');
    req.user = decoded;
    return next();
  } catch (err) {
    logger.error('Invalid token for protected route access', { error: err.message });
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }
    return res.redirect("/users/login");
  }
}

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Global Error Handler — MUST be the very last middleware.
// Ensures all unhandled errors return JSON for API/AJAX calls, never HTML.
app.use((err, req, res, next) => {
  logger.error("Unhandled Exception:", { error: err.message, stack: err.stack });
  const isApiRequest = req.path.startsWith('/api/') ||
                       req.xhr ||
                       (req.headers.accept && req.headers.accept.includes('application/json'));
  if (isApiRequest) {
    return res.status(500).json({ error: "An unexpected internal server error occurred." });
  }
  res.status(500).send("Internal Server Error");
});

module.exports = app;