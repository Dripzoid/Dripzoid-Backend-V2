import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const CLIENT_URL = process.env.CLIENT_URL;
const API_BASE = process.env.API_BASE;

export function configureGoogleAuth() {
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL ||
    (process.env.API_BASE
      ? `${process.env.API_BASE.replace(/\/+$/, "")}/api/auth/google/callback`
      : process.env.NODE_ENV === "production"
      ? "https://drz.yuvatejasainadh.me/api/auth/google/callback"
      : "http://localhost:5000/api/auth/google/callback");

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        callbackURL,
        passReqToCallback: true,
        proxy: true,
      },
      (req, accessToken, refreshToken, profile, done) => {
        return done(null, profile);
      }
    )
  );
}