import { authConfigured, getAuth } from "@/lib/auth";
export const runtime = "nodejs";
async function handle(request: Request) {
  if (!authConfigured())
    return Response.json(
      {
        message:
          "Sign-in is temporarily unavailable. Contact your website administrator.",
      },
      { status: 503 },
    );
  try {
    return await getAuth().handler(request);
  } catch {
    return Response.json(
      { message: "Sign-in is temporarily unavailable." },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
