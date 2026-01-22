/**
 * Speckit Server
 *
 * A variant of the Plannotator server specifically for spec-kit document review.
 * Adds file modification capabilities on approval.
 */

import { mkdirSync } from "fs";
import { isRemoteSession, getServerPort } from "./remote";
import { openBrowser } from "./browser";
import {
  type FileMapping,
  type SpeckitAnnotation,
  applyAnnotationsToFiles,
} from "./speckit";

// --- Types ---

export interface SpeckitServerOptions {
  /** The combined spec markdown content */
  plan: string;
  /** Feature/branch name */
  featureName: string;
  /** File mappings for applying annotations */
  fileMappings: FileMapping[];
  /** Origin identifier (e.g., "claude-code", "opencode") */
  origin: string;
  /** HTML content to serve for the UI */
  htmlContent: string;
  /** Whether URL sharing is enabled (default: true) */
  sharingEnabled?: boolean;
  /** Called when server starts with the URL, remote status, and port */
  onReady?: (url: string, isRemote: boolean, port: number) => void;
}

export interface SpeckitServerResult {
  /** The port the server is running on */
  port: number;
  /** The full URL to access the server */
  url: string;
  /** Whether running in remote mode */
  isRemote: boolean;
  /** Wait for user decision (approve/deny) */
  waitForDecision: () => Promise<{
    approved: boolean;
    feedback?: string;
    modifiedFiles?: string[];
    errors?: string[];
  }>;
  /** Stop the server */
  stop: () => void;
}

// --- Server Implementation ---

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 500;

/**
 * Start the Speckit server
 *
 * Similar to the Plannotator server but with speckit-specific features:
 * - Returns mode: "speckit" in the API response
 * - Applies annotations to source files on approval
 */
export async function startSpeckitServer(
  options: SpeckitServerOptions
): Promise<SpeckitServerResult> {
  const { plan, featureName, fileMappings, origin, htmlContent, sharingEnabled = true, onReady } = options;

  const isRemote = isRemoteSession();
  const configuredPort = getServerPort();

  // Decision promise
  let resolveDecision: (result: {
    approved: boolean;
    feedback?: string;
    modifiedFiles?: string[];
    errors?: string[];
  }) => void;
  const decisionPromise = new Promise<{
    approved: boolean;
    feedback?: string;
    modifiedFiles?: string[];
    errors?: string[];
  }>((resolve) => {
    resolveDecision = resolve;
  });

  // Start server with retry logic
  let server: ReturnType<typeof Bun.serve> | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      server = Bun.serve({
        port: configuredPort,

        async fetch(req) {
          const url = new URL(req.url);

          // API: Get plan content (with speckit mode indicator)
          if (url.pathname === "/api/plan") {
            return Response.json({
              plan,
              origin,
              sharingEnabled,
              mode: "speckit",
              featureName,
              fileMappings: fileMappings.map(m => ({
                filePath: m.filePath,
                startOffset: m.startOffset,
                endOffset: m.endOffset,
              })),
            });
          }

          // API: Serve images (local paths or temp uploads)
          if (url.pathname === "/api/image") {
            const imagePath = url.searchParams.get("path");
            if (!imagePath) {
              return new Response("Missing path parameter", { status: 400 });
            }
            try {
              const file = Bun.file(imagePath);
              if (!(await file.exists())) {
                return new Response("File not found", { status: 404 });
              }
              return new Response(file);
            } catch {
              return new Response("Failed to read file", { status: 500 });
            }
          }

          // API: Upload image -> save to temp -> return path
          if (url.pathname === "/api/upload" && req.method === "POST") {
            try {
              const formData = await req.formData();
              const file = formData.get("file") as File;
              if (!file) {
                return new Response("No file provided", { status: 400 });
              }

              const ext = file.name.split(".").pop() || "png";
              const tempDir = "/tmp/plannotator";
              mkdirSync(tempDir, { recursive: true });
              const tempPath = `${tempDir}/${crypto.randomUUID()}.${ext}`;

              await Bun.write(tempPath, file);
              return Response.json({ path: tempPath });
            } catch (err) {
              const message = err instanceof Error ? err.message : "Upload failed";
              return Response.json({ error: message }, { status: 500 });
            }
          }

          // API: Approve and apply changes
          if (url.pathname === "/api/approve" && req.method === "POST") {
            let feedback: string | undefined;
            let annotations: SpeckitAnnotation[] = [];

            try {
              const body = (await req.json().catch(() => ({}))) as {
                feedback?: string;
                annotations?: SpeckitAnnotation[];
              };

              feedback = body.feedback;
              annotations = body.annotations || [];
            } catch {
              // Use defaults
            }

            // Apply annotations to source files
            const result = await applyAnnotationsToFiles(annotations, fileMappings);

            resolveDecision({
              approved: true,
              feedback,
              modifiedFiles: result.modifiedFiles,
              errors: result.errors,
            });

            return Response.json({
              ok: true,
              modifiedFiles: result.modifiedFiles,
              errors: result.errors,
            });
          }

          // API: Deny (send feedback without applying changes)
          if (url.pathname === "/api/deny" && req.method === "POST") {
            let feedback = "Spec review denied by user";

            try {
              const body = (await req.json()) as { feedback?: string };
              feedback = body.feedback || feedback;
            } catch {
              // Use default feedback
            }

            resolveDecision({ approved: false, feedback });
            return Response.json({ ok: true });
          }

          // Serve embedded HTML for all other routes (SPA)
          return new Response(htmlContent, {
            headers: { "Content-Type": "text/html" },
          });
        },
      });

      break; // Success, exit retry loop
    } catch (err: unknown) {
      const isAddressInUse = err instanceof Error && err.message.includes("EADDRINUSE");

      if (isAddressInUse && attempt < MAX_RETRIES) {
        await Bun.sleep(RETRY_DELAY_MS);
        continue;
      }

      if (isAddressInUse) {
        const hint = isRemote ? " (set PLANNOTATOR_PORT to use different port)" : "";
        throw new Error(`Port ${configuredPort} in use after ${MAX_RETRIES} retries${hint}`);
      }

      throw err;
    }
  }

  if (!server) {
    throw new Error("Failed to start server");
  }

  const serverUrl = `http://localhost:${server.port}`;

  // Notify caller that server is ready
  if (onReady) {
    onReady(serverUrl, isRemote, server.port);
  }

  return {
    port: server.port,
    url: serverUrl,
    isRemote,
    waitForDecision: () => decisionPromise,
    stop: () => server.stop(),
  };
}

/**
 * Default behavior: open browser for local sessions
 */
export async function handleSpeckitServerReady(
  url: string,
  isRemote: boolean,
  _port: number
): Promise<void> {
  if (!isRemote) {
    await openBrowser(url);
  }
}
