const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { db } = require("./dbConfig");
const bcrypt = require("bcryptjs");
const logger = require("./utils/logger");

function initialize(passport) {
  console.log("Initialized");

  const authenticateUser = async (email, password, done) => {
    try {
      logger.debug('Authentication attempt', { email });
      const { data: users, error } = await db
        .from("users")
        .select("*")
        .eq("email", email);

      if (error) throw error;
      console.log(users);

      if (users.length > 0) {
        const user = users[0];

        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) {
            logger.error('Bcrypt comparison error', { error: err.message, email });
            return done(err);
          }
          if (isMatch) {
            return done(null, user);
          } else {
            //password is incorrect
            return done(null, false, { message: "Invalid email or password" });
          }
        });
      } else {
        // No user
        return done(null, false, {
          message: "Invalid email or password"
        });
      }
    } catch (err) {
      return done(err);
    }
  };

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      authenticateUser
    )
  );

  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET",
        callbackURL: "/auth/google/callback",
        proxy: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists with this Google ID
          const email = profile.emails[0].value;
          let { data: users, error: fetchError } = await db
            .from("users")
            .select("*")
            .eq("email", email);

          if (fetchError) throw fetchError;

          if (users.length === 0) {
            // Create new user
            const { data: newUserResults, error: insertError } = await db
              .from("users")
              .insert([
                { name: profile.displayName, email: email, password: 'google-oauth-' + profile.id, role: 'affiliate' }
              ])
              .select("*");

            if (insertError) throw insertError;
            return done(null, newUserResults[0]);
          }

          return done(null, users[0]);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
  // Stores user details inside session. serializeUser determines which data of the user
  // object should be stored in the session. The result of the serializeUser method is attached
  // to the session as req.session.passport.user = {}. Here for instance, it would be (as we provide
  //   the user id as the key) req.session.passport.user = {id: 'xyz'}
  passport.serializeUser((user, done) => done(null, user.id));

  // In deserializeUser that key is matched with the in memory array / database or any data resource.
  // The fetched object is attached to the request object as req.user

  passport.deserializeUser(async (id, done) => {
    try {
      const { data: users, error } = await db
        .from("users")
        .select("*")
        .eq("id", id);

      if (error) throw error;

      if (users.length > 0) {
        return done(null, users[0]);
      } else {
        return done(new Error("User not found"));
      }
    } catch (err) {
      return done(err);
    }
  });
}

module.exports = initialize;
