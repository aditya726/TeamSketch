const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

/**
 * Configure Passport with Google OAuth 2.0 Strategy
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists in our database
        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // User exists, return the user
          return done(null, user);
        }

        // Create new user
        user = await User.create({
          username: profile.emails[0].value.split('@')[0] + '_' + profile.id.substring(0, 6),
          email: profile.emails[0].value,
          password: 'google_oauth_' + Math.random().toString(36).substring(7), // Random password for OAuth users
          profile: {
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            avatar: profile.photos[0]?.value || 'https://via.placeholder.com/150'
          },
          isEmailVerified: true // Google emails are pre-verified
        });

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

/**
 * Serialize user for session
 */
passport.serializeUser((user, done) => {
  done(null, user._id);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
