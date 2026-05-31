import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    regionIds: string[];
    clinicIds: string[];
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      regionIds: string[];
      clinicIds: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    regionIds: string[];
    clinicIds: string[];
  }
}