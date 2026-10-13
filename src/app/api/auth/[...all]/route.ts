import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth/auth";

// The instance is built on the first request, so a missing BETTER_AUTH_SECRET fails there.
export const { GET, POST } = toNextJsHandler((request: Request) => getAuth().handler(request));
