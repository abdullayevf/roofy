"use server";
/** Sign out (prototype): forget who is signed in and which demo session is open, then show the sign-in page. The theme stays. */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, ROLE_COOKIE } from "@/data/session";

export async function signOut(): Promise<never> {
  const jar = await cookies();
  jar.delete(ROLE_COOKIE);
  jar.delete(DEMO_COOKIE);
  redirect("/sign-in");
}
