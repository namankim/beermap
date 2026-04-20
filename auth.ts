import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.name =
          typeof token.name === "string" ? token.name : (session.user.name ?? null);
        session.user.email =
          typeof token.email === "string"
            ? token.email
            : (session.user.email ?? null);
        session.user.image =
          typeof token.picture === "string"
            ? token.picture
            : (session.user.image ?? null);
      }

      return session;
    }
  }
});
