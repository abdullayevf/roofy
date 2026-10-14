"use server";
/**
 * Sign out: db mode ends the Better Auth session; both modes forget the prototype role and demo session,
 * then show the sign-in page. The theme stays.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isFakeMode, signOutOfDb } from "@/data";
import { DEMO_COOKIE, ROLE_COOKIE } from "@/data/session";

export async function signOut(): Promise<never> {
  if (!isFakeMode()) await signOutOfDb();
  const jar = await cookies();
  jar.delete(ROLE_COOKIE);
  jar.delete(DEMO_COOKIE);
  redirect("/sign-in");
}
