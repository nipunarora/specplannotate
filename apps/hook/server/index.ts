/**
 * Plannotator CLI for Claude Code
 *
 * Supports two modes:
 *
 * 1. Plan Review (default, no args):
 *    - Spawned by ExitPlanMode hook
 *    - Reads hook event from stdin, extracts plan content
 *    - Serves UI, returns approve/deny decision to stdout
 *
 * 2. Code Review (`plannotator review`):
 *    - Triggered by /review slash command
 *    - Runs git diff, opens review UI
 *    - Outputs feedback to stdout (captured by slash command)
 *
 * Environment variables:
 *   PLANNOTATOR_REMOTE - Set to "1" or "true" for remote mode (preferred)
 *   PLANNOTATOR_PORT   - Fixed port to use (default: random locally, 19432 for remote)
 */

import {
  startPlannotatorServer,
  handleServerReady,
} from "@plannotator/server";
import {
  startReviewServer,
  handleReviewServerReady,
} from "@plannotator/server/review";
import { getGitContext, runGitDiff, getCurrentBranch } from "@plannotator/server/git";
import {
  detectSpeckitContext,
  combineSpeckitDocuments,
  generateNoSpecError,
} from "@plannotator/server/speckit";
import {
  startSpeckitServer,
  handleSpeckitServerReady,
} from "@plannotator/server/speckit-server";

// Embed the built HTML at compile time
// @ts-ignore - Bun import attribute for text
import planHtml from "../dist/index.html" with { type: "text" };
const planHtmlContent = planHtml as unknown as string;

// @ts-ignore - Bun import attribute for text
import reviewHtml from "../dist/review.html" with { type: "text" };
const reviewHtmlContent = reviewHtml as unknown as string;

// Check for subcommand
const args = process.argv.slice(2);

// Check if URL sharing is enabled (default: true)
const sharingEnabled = process.env.PLANNOTATOR_SHARE !== "disabled";

if (args[0] === "review") {
  // ============================================
  // CODE REVIEW MODE
  // ============================================

  // Get git context (branches, available diff options)
  const gitContext = await getGitContext();

  // Run git diff HEAD (uncommitted changes - default)
  const { patch: rawPatch, label: gitRef } = await runGitDiff(
    "uncommitted",
    gitContext.defaultBranch
  );

  // Start review server (even if empty - user can switch diff types)
  const server = await startReviewServer({
    rawPatch,
    gitRef,
    origin: "claude-code",
    diffType: "uncommitted",
    gitContext,
    sharingEnabled,
    htmlContent: reviewHtmlContent,
    onReady: handleReviewServerReady,
  });

  // Wait for user feedback
  const result = await server.waitForDecision();

  // Give browser time to receive response and update UI
  await Bun.sleep(1500);

  // Cleanup
  server.stop();

  // Output feedback (captured by slash command)
  console.log(result.feedback || "No feedback provided.");
  process.exit(0);

} else if (args[0] === "speckit") {
  // ============================================
  // SPECKIT REVIEW MODE
  // ============================================

  // Detect spec-kit context from current git branch
  const speckitContext = await detectSpeckitContext();

  if (!speckitContext) {
    // Output helpful error message
    const branchName = await getCurrentBranch();
    console.log(generateNoSpecError(branchName));
    process.exit(0);
  }

  // Combine all spec documents into a single markdown
  const { markdown: combinedMarkdown, featureName, includedFiles, fileMappings } =
    await combineSpeckitDocuments(speckitContext);

  // Log included files for debugging
  console.error(`[Speckit] Reviewing feature: ${featureName}`);
  console.error(`[Speckit] Included files: ${includedFiles.join(", ")}`);

  // Start the speckit server with file modification support
  const server = await startSpeckitServer({
    plan: combinedMarkdown,
    featureName,
    fileMappings,
    origin: "claude-code",
    sharingEnabled,
    htmlContent: planHtmlContent,
    onReady: handleSpeckitServerReady,
  });

  // Wait for user decision
  const result = await server.waitForDecision();

  // Give browser time to receive response and update UI
  await Bun.sleep(1500);

  // Cleanup
  server.stop();

  // Output result
  if (result.approved) {
    if (result.modifiedFiles && result.modifiedFiles.length > 0) {
      console.log(`Spec approved. Modified files:\n${result.modifiedFiles.map(f => `  - ${f}`).join("\n")}`);
    } else {
      console.log("Spec approved (no file modifications).");
    }
    if (result.errors && result.errors.length > 0) {
      console.error(`Warnings:\n${result.errors.join("\n")}`);
    }
  } else {
    console.log(result.feedback || "Spec review denied by user.");
  }
  process.exit(0);

} else {
  // ============================================
  // PLAN REVIEW MODE (default)
  // ============================================

  // Read hook event from stdin
  const eventJson = await Bun.stdin.text();

  let planContent = "";
  let permissionMode = "default";
  try {
    const event = JSON.parse(eventJson);
    planContent = event.tool_input?.plan || "";
    permissionMode = event.permission_mode || "default";
  } catch {
    console.error("Failed to parse hook event from stdin");
    process.exit(1);
  }

  if (!planContent) {
    console.error("No plan content in hook event");
    process.exit(1);
  }

  // Start the plan review server
  const server = await startPlannotatorServer({
    plan: planContent,
    origin: "claude-code",
    permissionMode,
    sharingEnabled,
    htmlContent: planHtmlContent,
    onReady: (url, isRemote, port) => {
      handleServerReady(url, isRemote, port);
    },
  });

  // Wait for user decision (blocks until approve/deny)
  const result = await server.waitForDecision();

  // Give browser time to receive response and update UI
  await Bun.sleep(1500);

  // Cleanup
  server.stop();

  // Output JSON for PermissionRequest hook decision control
  if (result.approved) {
    // Build updatedPermissions to preserve the current permission mode
    const updatedPermissions = [];
    if (result.permissionMode) {
      updatedPermissions.push({
        type: "setMode",
        mode: result.permissionMode,
        destination: "session",
      });
    }

    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PermissionRequest",
          decision: {
            behavior: "allow",
            ...(updatedPermissions.length > 0 && { updatedPermissions }),
          },
        },
      })
    );
  } else {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PermissionRequest",
          decision: {
            behavior: "deny",
            message: result.feedback || "Plan changes requested",
          },
        },
      })
    );
  }

  process.exit(0);
}
