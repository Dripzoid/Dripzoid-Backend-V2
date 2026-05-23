import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const CLIENT_URL = process.env.CLIENT_URL;
const API_BASE = process.env.API_BASE;

export function configureGoogleAuth() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        callbackURL: `${API_BASE}/api/auth/google/callback`,
        passReqToCallback: true,
      },
      (req, accessToken, refreshToken, profile, done) => {
        return done(null, profile);
      }
    )
  );
}