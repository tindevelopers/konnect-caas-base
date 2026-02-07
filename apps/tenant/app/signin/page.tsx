import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | SaaS Admin",
  description: "Sign in to your SaaS admin dashboard",
};

export default function SignIn() {
  return <SignInForm />;
}

